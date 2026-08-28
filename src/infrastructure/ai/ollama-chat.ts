/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable functional/prefer-immutable-types -- AiProviderError tagged class is mutable by Data.TaggedError design */

import { Effect, Stream } from 'effect'
import { AiProviderError } from '@/application/ports/services/ai-service'
import type {
  AiError,
  ChatChunk,
  ChatInput,
  ChatReply,
  ChatToolCall,
} from '@/application/ports/services/ai-service'

/**
 * Ollama-native chat path for the eco-conception provider router.
 *
 * When `ECO_AI_PROVIDER_PRECEDENCE` routes an AI call to the local Ollama
 * provider, the request must go to Ollama's native `POST /api/chat` endpoint
 * (not the OpenAI-compatible `/chat/completions` shape the cloud providers
 * use). Ollama's request/response wire format differs:
 *   - request: `{ model, messages, stream, options: { temperature } }`
 *   - response: `{ model, message: { role, content }, done, ... }`
 * Streaming Ollama responses are NDJSON (one JSON object per line); rather
 * than re-implement that parser here, the streaming variant issues a
 * non-streaming request and emits the full reply as a single chunk — adequate
 * for the eco-routing specs and for `ai:*` automation steps (which only use
 * the non-streaming `chat`).
 */

/** Resolved Ollama connection: base URL, default model, and optional bearer
 * (Ollama ignores auth, but the E2E mock uses it for per-test isolation). */
export interface OllamaConn {
  readonly baseUrl: string
  readonly defaultModel: string
  /** `AI_API_KEY`, when set — forwarded as `Authorization: Bearer …`. */
  readonly apiKey: string | undefined
  /** Default temperature from `AI_TEMPERATURE` (undefined when unset). */
  readonly temperature: number | undefined
}

/**
 * Ollama's native `/api/chat` tool-call shape. It differs from the
 * OpenAI-compatible one in two ways that matter to the mapping below: there is
 * no per-call `id`, and `arguments` arrives as an OBJECT rather than a
 * JSON-encoded string.
 */
interface OllamaToolCall {
  readonly function?: {
    readonly name?: string
    readonly arguments?: unknown
  }
}

interface OllamaChatPayload {
  readonly model?: string
  readonly message?: {
    readonly content?: string | null
    readonly tool_calls?: ReadonlyArray<OllamaToolCall>
  }
}

const DEFAULT_OLLAMA_TEMPERATURE = 0.7

const ollamaUrl = (baseUrl: string): string => `${baseUrl.replace(/\/+$/, '')}/api/chat`

const ollamaHeaders = (apiKey: string | undefined): Record<string, string> => ({
  'Content-Type': 'application/json',
  ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
})

/**
 * Serialize the port's {@link ChatMessage} list onto Ollama's native wire
 * shape. The port carries the tool fields camel-cased (`toolCallId`,
 * `toolCalls`); Ollama expects `tool_calls` on the assistant message with
 * OBJECT `arguments` (unlike the OpenAI-compatible format, which JSON-encodes
 * them). Passing the port shape through verbatim would hand the daemon keys it
 * does not read, silently dropping the tool context on every follow-up turn.
 */
const serializeOllamaMessages = (
  messages: ChatInput['messages']
): ReadonlyArray<Record<string, unknown>> =>
  messages.map((message) => ({
    role: message.role,
    content: message.content,
    ...(message.toolCalls !== undefined && {
      tool_calls: message.toolCalls.map((call) => ({
        function: { name: call.name, arguments: call.arguments },
      })),
    }),
  }))

/**
 * Build the native `/api/chat` request body.
 *
 * `tools` is a TOP-LEVEL key on `/api/chat` (a sibling of `options`, not a
 * member of it) carrying the same JSON-Schema function definitions the
 * OpenAI-compatible providers take. Forwarding it is what makes tool calling
 * reachable on the sovereignty-default provider: the
 * models Sovrium ships against advertise a `tools` capability, so dropping the
 * field here silently downgraded every local turn to tool-blind.
 *
 * The key is omitted entirely when no tools are advertised — an empty `tools`
 * array is a different assertion than "no tools", both to the daemon and to the
 * spec contract that reads the recorded request.
 */
const ollamaBody = (
  conn: OllamaConn,
  input: ChatInput,
  stream: boolean
): Record<string, unknown> => ({
  model: input.model ?? conn.defaultModel,
  messages: serializeOllamaMessages(input.messages),
  stream,
  options: { temperature: input.temperature ?? conn.temperature ?? DEFAULT_OLLAMA_TEMPERATURE },
  ...(input.tools !== undefined && input.tools.length > 0 ? { tools: input.tools } : {}),
})

/**
 * Map Ollama's native `message.tool_calls[]` onto the port's
 * {@link ChatToolCall} shape so the shared tool-execution loop can drive it
 * unchanged. Ollama assigns no call id, so one is synthesised positionally —
 * the id is only ever used to correlate the follow-up tool-result message,
 * which this same adapter serialises.
 *
 * A non-object `arguments` (a model returning a JSON string, which some Ollama
 * builds do) is parsed rather than discarded; an unparseable value degrades to
 * an empty object so one malformed call cannot fail the whole turn.
 */
const extractOllamaToolCalls = (
  raw: ReadonlyArray<OllamaToolCall> | undefined
): ReadonlyArray<ChatToolCall> | undefined => {
  if (raw === undefined || raw.length === 0) return undefined
  return raw.map((call, index) => ({
    id: `call_${String(index)}`,
    name: call.function?.name ?? '',
    arguments: parseToolArguments(call.function?.arguments),
  }))
}

/** Normalise a tool-call `arguments` value to a record. */
const parseToolArguments = (value: unknown): Record<string, unknown> => {
  if (typeof value === 'object' && value !== null) return value as Record<string, unknown>
  if (typeof value !== 'string') return {}
  try {
    const parsed = JSON.parse(value) as unknown
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

const mapOllamaError = (cause: unknown): AiError => {
  if (cause instanceof AiProviderError) return cause
  return new AiProviderError({
    statusCode: 502,
    message: `Ollama request failed: ${cause instanceof Error ? cause.message : String(cause)}`,
    cause,
  })
}

/** POST to Ollama's `/api/chat` (non-streaming) and reduce to a {@link ChatReply}. */
export const ollamaChat = (conn: OllamaConn, input: ChatInput): Effect.Effect<ChatReply, AiError> =>
  Effect.tryPromise({
    try: async () => {
      const model = input.model ?? conn.defaultModel
      const response = await fetch(ollamaUrl(conn.baseUrl), {
        method: 'POST',
        headers: ollamaHeaders(conn.apiKey),
        // Schema would be ceremonial here: the request body is Ollama's
        // native `/api/chat` wire format (an opaque `Record<string, unknown>`
        // assembled by `ollamaBody`). The HTTP layer needs a JSON string,
        // not a decoded domain value.
        // @effect-diagnostics-next-line effect/preferSchemaOverJson:off
        body: JSON.stringify(ollamaBody(conn, input, false)),
      })
      if (!response.ok) {
        const body = await response.text().catch(() => '')
        // eslint-disable-next-line functional/no-throw-statements -- Effect.tryPromise.catch maps thrown values to tagged errors
        throw new AiProviderError({
          statusCode: response.status,
          message: `Ollama returned HTTP ${String(response.status)}: ${body.slice(0, 200)}`,
        })
      }
      const payload = (await response.json()) as OllamaChatPayload
      const toolCalls = extractOllamaToolCalls(payload.message?.tool_calls)
      const rawContent = payload.message?.content
      // A tool-call turn legitimately carries no assistant text, so an absent
      // `content` is only malformed when no tool calls came back with it.
      const content = typeof rawContent === 'string' ? rawContent : toolCalls ? '' : undefined
      if (content === undefined) {
        // eslint-disable-next-line functional/no-throw-statements -- Effect.tryPromise.catch maps thrown values to tagged errors
        throw new AiProviderError({
          statusCode: 502,
          message: 'Ollama returned a malformed chat response',
        })
      }
      return {
        content,
        model: payload.model ?? model,
        ...(toolCalls !== undefined && { toolCalls }),
      } satisfies ChatReply
    },
    catch: mapOllamaError,
  })

/** Stream variant: issues a non-streaming Ollama request and emits the reply
 * as a single `content` chunk followed by the terminating `done` chunk. */
export const ollamaChatStream = (
  conn: OllamaConn,
  input: ChatInput
): Stream.Stream<ChatChunk, AiError> =>
  Stream.unwrap(
    ollamaChat(conn, input).pipe(
      Effect.map((reply): Stream.Stream<ChatChunk, AiError> => {
        const chunks: ReadonlyArray<ChatChunk> = [
          { type: 'content', delta: reply.content },
          { type: 'done', model: reply.model },
        ]
        return Stream.fromIterable(chunks)
      })
    )
  )
