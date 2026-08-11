/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable functional/prefer-immutable-types -- AiError/AiConfigError tagged classes are mutable by Data.TaggedError design */

import { Effect, Layer, Stream } from 'effect'
import {
  AiService,
  AiProviderError,
  AiConfigError,
  AiTimeoutError,
  type ChatInput,
  type ChatReply,
  type ChatChunk,
  type ChatToolCall,
  type AiError,
  type EmbedInput,
} from '@/application/ports/services/ai-service'
import { resolveAiEcoRouting, resolveOllamaBaseUrl } from '@/domain/models/env/ai/ai-eco-routing'
import { traceAiRequest } from '@/infrastructure/telemetry/ai-request-trace'
import {
  DEFAULT_CLOUD_EMBEDDING_MODEL,
  DEFAULT_OLLAMA_EMBEDDING_MODEL,
  embedOllama,
  embedOpenAi,
} from './embed'
import { ollamaChat, ollamaChatStream } from './ollama-chat'
import { probeOllamaReachable } from './ollama-reachability'
import { parseAiEnvConfig } from './parse-ai-env-config'
import { parseSseChunks } from './sse-stream-parser'

/**
 * AI Service Live adapter.
 *
 * Mirrors `StorageServiceLive` in shape:
 * - Reads env config once at layer construction
 * - Returns a no-op stub when the provider is unset (matches Storage's
 *   no-storage fallback per `project_storage_provider_contract`)
 * - When configured, calls an OpenAI-compatible `/chat/completions`
 *   endpoint at `${AI_BASE_URL}/chat/completions`. The mock test server
 * and the existing
 *   `AiComputeListener` already speak this shape.
 *
 * Error mapping:
 * - Non-2xx HTTP responses become `AiProviderError(statusCode, message)`
 *   so the route layer can return a sensible HTTP status. Mapping
 *   provider 5xx → HTTP 502 is the route's responsibility, not the
 *   adapter's.
 * - Missing-config calls become `AiConfigError` (used by the no-op stub
 *   and by post-construction guards).
 */

interface RawToolCall {
  readonly id?: string
  readonly function?: { readonly name?: string; readonly arguments?: string }
}

interface ChatCompletionPayload {
  readonly choices?: ReadonlyArray<{
    readonly message?: {
      readonly content?: string | null
      readonly tool_calls?: ReadonlyArray<RawToolCall>
    }
  }>
  readonly model?: string
}

const notConfiguredError = (): AiConfigError =>
  new AiConfigError({
    message:
      'AI provider not configured. Set AI_PROVIDER (and AI_BASE_URL / AI_API_KEY) to enable AI chat.',
  })

const missingCredentialsError = (): AiConfigError =>
  new AiConfigError({
    message: 'AI_BASE_URL and AI_API_KEY must both be set to call the AI provider.',
  })

const streamFailedError = (cause: unknown): AiError =>
  new AiProviderError({
    statusCode: 502,
    message: `AI provider stream failed: ${cause instanceof Error ? cause.message : String(cause)}`,
    cause,
  })

/**
 * Default LLM temperature applied when neither the per-request input nor the
 * `AI_TEMPERATURE` env var specifies one. Matches the `AI_TEMPERATURE`
 * env-var contract (frugal, deterministic-leaning default).
 */
const DEFAULT_TEMPERATURE = 0.7

/**
 * Default maximum output tokens applied when neither the per-request input
 * nor the `AI_MAX_TOKENS` env var specifies one. Keeps every provider
 * request explicit about its output budget.
 */
const DEFAULT_MAX_TOKENS = 4096

interface AiDefaults {
  /** Resolved from `AI_TEMPERATURE` (undefined when unset). */
  readonly temperature: number | undefined
  /** Resolved from `AI_MAX_TOKENS` (undefined when unset). */
  readonly maxTokens: number | undefined
}

/**
 * Resolved provider connection — bundled so the call helpers stay within the
 * 4-parameter limit (`max-params`) while still carrying base URL, credentials,
 * default model, and the common-parameter defaults.
 */
interface ProviderConn {
  readonly baseUrl: string
  readonly apiKey: string
  readonly defaultModel: string
  readonly defaults: AiDefaults
}

/**
 * Serialize the port's {@link ChatMessage} list onto the OpenAI-compatible
 * wire shape. Camel-cased tool fields (`toolCallId`, `toolCalls`) are
 * translated to the wire's snake_case (`tool_call_id`, `tool_calls`), and the
 * assistant `tool_calls[]` are re-encoded with a JSON-string `arguments`
 * field so a real provider can correlate a follow-up tool result.
 */
const serializeMessages = (
  messages: ChatInput['messages']
): ReadonlyArray<Record<string, unknown>> =>
  messages.map((message) => ({
    role: message.role,
    content: message.content,
    ...(message.toolCallId !== undefined && { tool_call_id: message.toolCallId }),
    ...(message.toolCalls !== undefined && {
      tool_calls: message.toolCalls.map((call) => ({
        id: call.id,
        type: 'function',
        function: { name: call.name, arguments: JSON.stringify(call.arguments) },
      })),
    }),
  }))

/**
 * Build the OpenAI-compatible request body, layering the common AI
 * parameters: per-request input wins, then the `AI_*` env defaults, then a
 * hard-coded fallback. Both `temperature` and `max_tokens` are always
 * present on the request so behaviour is uniform across providers.
 */
const buildRequestBody = (
  model: string,
  defaults: AiDefaults,
  input: ChatInput,
  extra: Readonly<Record<string, unknown>> = {}
): Record<string, unknown> => {
  const temperature = input.temperature ?? defaults.temperature ?? DEFAULT_TEMPERATURE
  const maxTokens = input.maxTokens ?? defaults.maxTokens ?? DEFAULT_MAX_TOKENS
  return {
    model,
    messages: serializeMessages(input.messages),
    temperature,
    max_tokens: maxTokens,
    ...(input.responseFormat ? { response_format: input.responseFormat } : {}),
    ...(input.tools !== undefined && input.tools.length > 0 ? { tools: input.tools } : {}),
    ...extra,
  }
}

/**
 * Extract the OpenAI-compatible `tool_calls[]` from a chat-completion message
 * into the port's {@link ChatToolCall} shape. The wire format carries each
 * call's `arguments` as a JSON string; a malformed string degrades to an
 * empty object rather than failing the whole turn.
 */
const extractToolCalls = (
  raw: ReadonlyArray<RawToolCall> | undefined
): ReadonlyArray<ChatToolCall> | undefined => {
  if (raw === undefined || raw.length === 0) return undefined
  return raw.map((call, index) => {
    const argsString = call.function?.arguments ?? '{}'
    const parsed = ((): Record<string, unknown> => {
      try {
        const value = JSON.parse(argsString) as unknown
        return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
      } catch {
        return {}
      }
    })()
    return {
      id: call.id ?? `call_${String(index)}`,
      name: call.function?.name ?? '',
      arguments: parsed,
    }
  })
}

/**
 * True when a thrown `fetch`/body-read rejection is an abort caused by the
 * `AbortSignal.timeout` deadline. `AbortSignal.timeout` rejects with a
 * `DOMException` whose `name` is `'TimeoutError'` (or `'AbortError'`).
 *
 * NOTE: a 1ms-class deadline frequently lets the HTTP *headers* arrive — so
 * `fetch` itself resolves — but tears down the *body* stream mid-read. That
 * surfaces as a `SyntaxError` ("Unexpected end of JSON input") from
 * `response.json()`, NOT a `TimeoutError`. The caller therefore also consults
 * `signal.aborted` to classify a body-read failure as a timeout.
 */
const isAbortTimeout = (cause: unknown): boolean =>
  cause instanceof Error && (cause.name === 'TimeoutError' || cause.name === 'AbortError')

/** A timeout error keyed to the caller-supplied per-call deadline. */
const timeoutError = (timeoutMs: number | undefined): AiTimeoutError =>
  new AiTimeoutError({
    message: 'AI provider request timed out before a response was received.',
    timeoutMs: timeoutMs ?? 0,
  })

/**
 * Read and validate a successful chat-completion HTTP response into a
 * {@link ChatReply}.
 *
 * A deadline that fired after the headers arrived tears down the body stream —
 * `response.json()` then throws a `SyntaxError`. When `signal.aborted` is set
 * such a body-read failure is reclassified as an {@link AiTimeoutError};
 * otherwise it is a genuine malformed-JSON `AiProviderError` (502-class).
 */
const parseChatResponse = async (
  response: Response,
  model: string,
  input: ChatInput,
  signal: AbortSignal | undefined
): Promise<ChatReply> => {
  const payload = await response.json().catch((bodyErr: unknown) => {
    // eslint-disable-next-line functional/no-throw-statements -- Effect.tryPromise.catch maps thrown values to tagged errors
    if (signal?.aborted === true) throw timeoutError(input.timeoutMs)
    // eslint-disable-next-line functional/no-throw-statements -- Effect.tryPromise.catch maps thrown values to tagged errors
    throw new AiProviderError({
      statusCode: 502,
      message: `AI provider returned a malformed JSON response: ${
        bodyErr instanceof Error ? bodyErr.message : String(bodyErr)
      }`,
    })
  })
  const message = (payload as ChatCompletionPayload).choices?.[0]?.message
  const content = message?.content
  const toolCalls = extractToolCalls(message?.tool_calls)
  // A `tool_calls` response carries `content: null` — that is valid, not a
  // malformed reply. Only a response with neither textual content NOR tool
  // calls is rejected as malformed.
  if (typeof content !== 'string' && toolCalls === undefined) {
    // eslint-disable-next-line functional/no-throw-statements -- Effect.tryPromise.catch maps thrown values to tagged errors
    throw new AiProviderError({
      statusCode: 502,
      message: 'AI provider returned a malformed chat-completion response',
    })
  }
  return {
    content: typeof content === 'string' ? content : '',
    model: (payload as ChatCompletionPayload).model ?? model,
    ...(toolCalls !== undefined && { toolCalls }),
  } satisfies ChatReply
}

const callChatCompletions = (
  conn: ProviderConn,
  input: ChatInput
): Effect.Effect<ChatReply, AiError> =>
  Effect.tryPromise({
    try: async () => {
      const model = input.model ?? conn.defaultModel
      // Per-call deadline: when `timeoutMs` is set the
      // request is aborted deterministically at the deadline — far more
      // reliable than racing an Effect timer against the round-trip. Kept in a
      // local so the body parser can consult `.aborted` to distinguish a
      // deadline-induced body-read failure from a genuine malformed response.
      const signal =
        input.timeoutMs !== undefined ? AbortSignal.timeout(input.timeoutMs) : undefined
      const response = await fetch(`${conn.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${conn.apiKey}`,
        },
        // Schema would be ceremonial here: the request body is the
        // OpenAI-compatible wire format (an opaque `Record<string, unknown>`
        // assembled by `buildRequestBody`). The HTTP layer needs a JSON
        // string, not a decoded domain value.
        // @effect-diagnostics-next-line effect/preferSchemaOverJson:off
        body: JSON.stringify(buildRequestBody(model, conn.defaults, input)),
        ...(signal !== undefined ? { signal } : {}),
      })

      if (!response.ok) {
        // Read the body as text best-effort so the error message carries the
        // provider's own diagnostic — invaluable when debugging E2E specs.
        const body = await response.text().catch(() => '')
        // eslint-disable-next-line functional/no-throw-statements -- Effect.tryPromise.catch maps thrown values to tagged errors
        throw new AiProviderError({
          statusCode: response.status,
          message: `AI provider returned HTTP ${String(response.status)}: ${body.slice(0, 200)}`,
        })
      }

      return await parseChatResponse(response, model, input, signal)
    },
    catch: (cause: unknown): AiError => {
      if (
        cause instanceof AiProviderError ||
        cause instanceof AiConfigError ||
        cause instanceof AiTimeoutError
      ) {
        return cause
      }
      if (isAbortTimeout(cause)) {
        return timeoutError(input.timeoutMs)
      }
      return new AiProviderError({
        statusCode: 502,
        message: `AI provider request failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        cause,
      })
    },
  })

const sendStreamingRequest = async (
  conn: ProviderConn,
  model: string,
  input: ChatInput
): Promise<Response> =>
  fetch(`${conn.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${conn.apiKey}`,
    },
    body: JSON.stringify(buildRequestBody(model, conn.defaults, input, { stream: true })),
  })

const responseToStream = async (
  response: Response,
  model: string
): Promise<Stream.Stream<ChatChunk, AiError>> => {
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    // eslint-disable-next-line functional/no-throw-statements -- Effect.tryPromise.catch maps thrown values to tagged errors
    throw new AiProviderError({
      statusCode: response.status,
      message: `AI provider returned HTTP ${String(response.status)}: ${body.slice(0, 200)}`,
    })
  }
  if (response.body === null) {
    // eslint-disable-next-line functional/no-throw-statements -- Effect.tryPromise.catch maps thrown values to tagged errors
    throw new AiProviderError({
      statusCode: 502,
      message: 'AI provider returned a streaming response with no body',
    })
  }
  return Stream.fromAsyncIterable(parseSseChunks(response.body, model), streamFailedError)
}

const mapStreamRequestError = (cause: unknown): AiError => {
  if (cause instanceof AiProviderError || cause instanceof AiConfigError) {
    return cause
  }
  return new AiProviderError({
    statusCode: 502,
    message: `AI provider stream request failed: ${cause instanceof Error ? cause.message : String(cause)}`,
    cause,
  })
}

const openChatStream = (
  conn: ProviderConn,
  input: ChatInput
): Stream.Stream<ChatChunk, AiError> => {
  // Issue the streaming request lazily inside an Effect so its failure is
  // surfaced on the Stream's error channel — Stream.unwrap then turns the
  // returned-stream-or-error Effect into a Stream of the inner type.
  const open: Effect.Effect<Stream.Stream<ChatChunk, AiError>, AiError> = Effect.tryPromise({
    try: async () => {
      const model = input.model ?? conn.defaultModel
      const response = await sendStreamingRequest(conn, model, input)
      return await responseToStream(response, model)
    },
    catch: mapStreamRequestError,
  })

  return Stream.unwrap(open)
}

const notConfiguredStub = (): ReturnType<typeof AiService.of> =>
  // No-op stub: every chat()/chatStream() fails with a clear "not configured"
  // error. The stream variant fails on its error channel rather than throwing
  // synchronously so consumers can map it uniformly with the live-stream path.
  AiService.of({
    chat: (_input: ChatInput) => Effect.fail(notConfiguredError()),
    chatStream: (_input: ChatInput) => Stream.fail(notConfiguredError()),
    embed: (_input: EmbedInput) => Effect.fail(notConfiguredError()),
    embeddingModel: () => process.env.AI_EMBEDDING_MODEL?.trim() || DEFAULT_CLOUD_EMBEDDING_MODEL,
    isConfigured: () => false,
  })

/**
 * Live adapter routed to the local Ollama provider (per
 * `ECO_AI_PROVIDER_PRECEDENCE`). Uses Ollama's native `/api/chat` endpoint
 * rather than the OpenAI-compatible shape the cloud providers use. The
 * configured `AI_API_KEY` (if any) is forwarded as a bearer token — Ollama
 * ignores it, but the E2E mock server uses it for per-test isolation.
 */
const makeOllamaAdapter = (
  ollamaBaseUrl: string,
  config: ReturnType<typeof parseAiEnvConfig>
): ReturnType<typeof AiService.of> => {
  const conn = {
    baseUrl: ollamaBaseUrl,
    defaultModel: config.model ?? 'llama3.1',
    apiKey: config.apiKey,
    temperature: config.temperature,
  }
  const embeddingModel = process.env.AI_EMBEDDING_MODEL?.trim() || DEFAULT_OLLAMA_EMBEDDING_MODEL
  return AiService.of({
    // Instrument the shared chat seam: `ai.request` child span + duration/count
    // metrics, labeled by the resolved provider (`ollama`), the request's model,
    // and the operation (`chat`) — never prompt text / user ids.
    chat: (input: ChatInput) =>
      traceAiRequest('ollama', input.model ?? conn.defaultModel, 'chat', ollamaChat(conn, input)),
    chatStream: (input: ChatInput) => ollamaChatStream(conn, input),
    embed: (input: EmbedInput) =>
      embedOllama({ baseUrl: ollamaBaseUrl, apiKey: config.apiKey, model: embeddingModel }, input),
    embeddingModel: () => embeddingModel,
    isConfigured: () => true,
  })
}

/**
 * Live adapter routed to an OpenAI-compatible cloud provider — the original
 * `${AI_BASE_URL}/chat/completions` behaviour. Credentials are validated
 * lazily on first call so configuration-shape specs can assert on a missing
 * `AI_BASE_URL`/`AI_API_KEY` without the layer crashing at construction.
 */
const makeCloudAdapter = (
  config: ReturnType<typeof parseAiEnvConfig>,
  provider: string
): ReturnType<typeof AiService.of> => {
  const { baseUrl, apiKey } = config
  const defaultModel = config.model ?? 'mock-model'
  const defaults: AiDefaults = { temperature: config.temperature, maxTokens: config.maxTokens }
  const embeddingModel = process.env.AI_EMBEDDING_MODEL?.trim() || DEFAULT_CLOUD_EMBEDDING_MODEL
  return AiService.of({
    // Instrument the shared chat seam: `ai.request` child span + duration/count
    // metrics, labeled by the resolved cloud provider, the request's model, and
    // the operation (`chat`) — never prompt text / user ids / keys.
    chat: (input: ChatInput) =>
      traceAiRequest(
        provider,
        input.model ?? defaultModel,
        'chat',
        baseUrl === undefined || apiKey === undefined
          ? Effect.fail(missingCredentialsError())
          : callChatCompletions({ baseUrl, apiKey, defaultModel, defaults }, input)
      ),
    chatStream: (input: ChatInput) =>
      baseUrl === undefined || apiKey === undefined
        ? Stream.fail(missingCredentialsError())
        : openChatStream({ baseUrl, apiKey, defaultModel, defaults }, input),
    embed: (input: EmbedInput) =>
      baseUrl === undefined
        ? Effect.fail(missingCredentialsError())
        : embedOpenAi({ baseUrl, apiKey, model: embeddingModel }, input),
    embeddingModel: () => embeddingModel,
    isConfigured: () => true,
  })
}

export const AiServiceLive = Layer.effect(
  AiService,
  Effect.gen(function* () {
    const config = parseAiEnvConfig()
    const ollamaBaseUrl = resolveOllamaBaseUrl(process.env)
    // Probe Ollama once at layer construction so the eco resolver can route
    // calls to the local provider (or fall back to the configured cloud).
    const ollamaReachable = yield* Effect.promise(() => probeOllamaReachable(ollamaBaseUrl))
    const routing = resolveAiEcoRouting(process.env, ollamaReachable)

    // AI disabled: neither AI_PROVIDER (cloud) nor a usable Ollama endpoint.
    if (routing.resolvedProvider === undefined) return notConfiguredStub()

    if (routing.resolvedProvider === 'ollama' && ollamaBaseUrl !== undefined) {
      return makeOllamaAdapter(ollamaBaseUrl, config)
    }
    // `resolvedProvider` is a non-undefined `SupportedAiProvider` here (the
    // AI-disabled case returned above) — carry it as the seam's `provider` label.
    return makeCloudAdapter(config, routing.resolvedProvider)
  })
)
