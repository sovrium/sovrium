/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Ollama's native `/api/chat`, as an `effect/ai` `LanguageModel` ([internal ref] D4).
 *
 * Not `@effect/ai-openai-compat` pointed at Ollama's `/v1`: the native endpoint
 * is the one that takes a context size (`options.num_ctx`) and `keep_alive`,
 * and the one the reachability probe already speaks, so one `OLLAMA_BASE_URL`
 * serves both (the measurement is recorded in [internal ref] D4).
 *
 * It streams for real: the native endpoint answers NDJSON, one JSON object per
 * line, the last one carrying `done: true` and the token counts. A buffered
 * call sends `stream: false` and reads the one object back.
 *
 * The request body is the one this path has always sent — `model`, `messages`,
 * `stream`, `options.temperature`, and `tools` when the call advertises any —
 * so the switch to `LanguageModel` changes nothing on the wire.
 *
 * Requests go through the bounded `HttpClient` of [internal ref] D5: a header
 * deadline, the egress retry schedule for a buffered call, never a retry for a
 * streamed one.
 */

import { Context, Effect, Stream } from 'effect'
import { AiError, LanguageModel, Tool } from 'effect/ai'
import { HttpClient, HttpClientRequest } from 'effect/http'
import { splitThinkTags } from './think-tag-splitter'
import type { Prompt, Response } from 'effect/ai'
import type { HttpClientError, HttpClientResponse } from 'effect/http'

/** The settings of one call, scoped by the adapter around it. */
export interface OllamaCallSettings {
  readonly model: string
  readonly temperature: number
}

/**
 * The current call's settings. A reference, so a call made with none in scope
 * still has a model to send: the connection's default.
 */
export const OllamaCallConfig = Context.Reference<OllamaCallSettings | undefined>(
  'sovrium/ai/OllamaCallConfig',
  { defaultValue: () => undefined }
)

/** How to reach the daemon. */
export interface OllamaConnection {
  readonly baseUrl: string
  /** `AI_API_KEY`, when set — forwarded as a bearer token. Ollama ignores it. */
  readonly apiKey: string | undefined
  readonly defaultModel: string
  readonly defaultTemperature: number
}

interface OllamaToolCall {
  readonly function?: { readonly name?: string; readonly arguments?: unknown }
}

interface OllamaChatLine {
  readonly model?: string
  readonly message?: {
    readonly content?: string | null
    readonly thinking?: string | null
    /** Absent, empty, or `null` all mean "no tool call". */
    readonly tool_calls?: ReadonlyArray<OllamaToolCall> | null
  }
  readonly done?: boolean
  readonly done_reason?: string
  readonly prompt_eval_count?: number
  readonly eval_count?: number
}

// ---------------------------------------------------------------------------
// Prompt -> Ollama messages
// ---------------------------------------------------------------------------

const textOf = (parts: ReadonlyArray<{ readonly type: string; readonly text?: string }>): string =>
  parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text ?? '')
    .join('')

/** A base64 image, the shape Ollama's `images` field takes. */
const imageData = (part: Prompt.FilePart): string | undefined => {
  if (!part.mediaType.startsWith('image/')) return undefined
  if (typeof part.data === 'string') return part.data.replace(/^data:[^;]+;base64,/, '')
  return part.data instanceof Uint8Array ? Buffer.from(part.data).toString('base64') : undefined
}

const toOllamaMessages = (prompt: Prompt.Prompt): ReadonlyArray<Record<string, unknown>> =>
  prompt.content.flatMap((message): ReadonlyArray<Record<string, unknown>> => {
    switch (message.role) {
      case 'system':
        return [{ role: 'system', content: message.content }]
      case 'user': {
        const images = message.content
          .filter((part): part is Prompt.FilePart => part.type === 'file')
          .map(imageData)
          .filter((data): data is string => data !== undefined)
        return [
          {
            role: 'user',
            content: textOf(message.content),
            ...(images.length > 0 && { images }),
          },
        ]
      }
      case 'assistant': {
        const calls = message.content.filter(
          (part): part is Prompt.ToolCallPart => part.type === 'tool-call'
        )
        return [
          {
            role: 'assistant',
            content: textOf(message.content),
            ...(calls.length > 0 && {
              tool_calls: calls.map((call) => ({
                function: { name: call.name, arguments: call.params },
              })),
            }),
          },
        ]
      }
      case 'tool':
        return message.content
          .filter((part): part is Prompt.ToolResultPart => part.type === 'tool-result')
          .map((part) => ({
            role: 'tool',
            content: typeof part.result === 'string' ? part.result : JSON.stringify(part.result),
          }))
    }
  })

/** The advertised tools in the chat-completions shape Ollama's `tools` takes. */
const toOllamaTools = (
  tools: ReadonlyArray<Tool.Any>
): ReadonlyArray<Record<string, unknown>> | undefined =>
  tools.length === 0
    ? undefined
    : tools.map((tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: Tool.getDescription(tool) ?? '',
          parameters: Tool.getJsonSchema(tool),
        },
      }))

// ---------------------------------------------------------------------------
// Ollama lines -> Response parts
// ---------------------------------------------------------------------------

const parseArguments = (value: unknown): Record<string, unknown> => {
  if (typeof value === 'object' && value !== null) return value as Record<string, unknown>
  if (typeof value !== 'string') return {}
  try {
    const parsed = JSON.parse(value) as unknown
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

/** The tool calls of one line, positional ids — Ollama assigns none. */
const toolCallParts = (line: OllamaChatLine, offset: number): Response.ToolCallPartEncoded[] =>
  (line.message?.tool_calls ?? []).map((call, index) => ({
    type: 'tool-call',
    id: `call_${String(offset + index)}`,
    name: call.function?.name ?? '',
    params: parseArguments(call.function?.arguments),
  }))

const usageOf = (line: OllamaChatLine): typeof Response.Usage.Encoded => ({
  inputTokens: { total: line.prompt_eval_count },
  outputTokens: { total: line.eval_count },
})

const finishPart = (line: OllamaChatLine, hasToolCalls: boolean): Response.FinishPartEncoded => ({
  type: 'finish',
  reason: hasToolCalls ? 'tool-calls' : line.done_reason === 'length' ? 'length' : 'stop',
  usage: usageOf(line),
})

const malformed = (method: string): AiError.AiError =>
  AiError.make({
    module: 'OllamaLanguageModel',
    method,
    reason: new AiError.InvalidOutputError({
      description: 'Ollama returned a malformed chat response',
    }),
  })

/** A whole buffered reply as response parts; malformed when it has neither text nor a tool call. */
const toBufferedParts = (
  line: OllamaChatLine,
  model: string
): Effect.Effect<Response.PartEncoded[], AiError.AiError> => {
  const calls = toolCallParts(line, 0)
  const raw = line.message?.content
  if (typeof raw !== 'string' && calls.length === 0) return Effect.fail(malformed('generateText'))
  const { content, reasoning } = splitThinkTags(typeof raw === 'string' ? raw : '')
  const thinking = `${line.message?.thinking ?? ''}${reasoning}`
  return Effect.succeed([
    { type: 'response-metadata', modelId: line.model ?? model },
    ...(thinking.length > 0 ? [{ type: 'reasoning' as const, text: thinking }] : []),
    { type: 'text', text: content },
    ...calls,
    finishPart(line, calls.length > 0),
  ])
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

const requestDetails = (request: HttpClientRequest.HttpClientRequest) => ({
  method: request.method,
  url: request.url,
  urlParams: Array.from(request.urlParams),
  hash: undefined,
  headers: {},
})

/** A transport failure, or a status Ollama answered with, as an `AiError`. */
const transportError = (method: string) => (error: HttpClientError.HttpClientError) =>
  AiError.make({
    module: 'OllamaLanguageModel',
    method,
    reason:
      error.reason._tag === 'TransportError' ||
      error.reason._tag === 'EncodeError' ||
      error.reason._tag === 'InvalidUrlError'
        ? AiError.NetworkError.fromRequestError(error.reason)
        : new AiError.InvalidOutputError({ description: error.message }),
  })

const statusError = (
  method: string,
  response: HttpClientResponse.HttpClientResponse
): Effect.Effect<never, AiError.AiError> =>
  Effect.flatMap(
    // effect-swallow: the body only enriches the error message; a body that cannot be read leaves it out.
    Effect.orElseSucceed(response.text, () => ''),
    (body) =>
      Effect.fail(
        AiError.make({
          module: 'OllamaLanguageModel',
          method,
          reason: AiError.reasonFromHttpStatus({
            status: response.status,
            http: {
              request: requestDetails(response.request),
              response: { status: response.status, headers: {} },
              body,
            },
          }),
        })
      )
  )

/** The stream position across NDJSON lines. */
interface LineState {
  readonly started: boolean
  readonly toolCalls: number
}

/**
 * One NDJSON line as stream parts. Positional tool-call ids continue across
 * lines, so two calls in two lines never share an id.
 */
export const lineStreamParts = (
  line: OllamaChatLine,
  state: LineState,
  model: string
): { readonly parts: readonly Response.StreamPartEncoded[]; readonly state: LineState } => {
  const thinking = line.message?.thinking ?? ''
  const content = line.message?.content ?? ''
  const calls = toolCallParts(line, state.toolCalls)
  const toolCalls = state.toolCalls + calls.length
  const parts: readonly Response.StreamPartEncoded[] = [
    ...(state.started
      ? []
      : [
          { type: 'response-metadata' as const, modelId: line.model ?? model },
          { type: 'text-start' as const, id: 'text' },
        ]),
    ...(thinking.length > 0
      ? [{ type: 'reasoning-delta' as const, id: 'reasoning', delta: thinking }]
      : []),
    ...(content.length > 0 ? [{ type: 'text-delta' as const, id: 'text', delta: content }] : []),
    ...calls,
    ...(line.done === true
      ? [{ type: 'text-end' as const, id: 'text' }, finishPart(line, toolCalls > 0)]
      : []),
  ]
  return { parts, state: { started: true, toolCalls } }
}

/** The request body this path has always sent. */
const requestBody = (
  options: LanguageModel.ProviderOptions,
  settings: OllamaCallSettings,
  stream: boolean
): Record<string, unknown> => {
  const tools = toOllamaTools(options.tools)
  return {
    model: settings.model,
    messages: toOllamaMessages(options.prompt),
    stream,
    options: { temperature: settings.temperature },
    ...(tools !== undefined && { tools }),
  }
}

/** POST one chat request; a non-2xx answer is an `AiError` carrying its status and body. */
const sendChat = (
  conn: OllamaConnection,
  client: HttpClient.HttpClient,
  call: {
    readonly options: LanguageModel.ProviderOptions
    readonly stream: boolean
    readonly method: string
  }
) =>
  Effect.gen(function* () {
    const settings = (yield* Effect.service(OllamaCallConfig)) ?? {
      model: conn.defaultModel,
      temperature: conn.defaultTemperature,
    }
    const request = HttpClientRequest.post(`${conn.baseUrl.replace(/\/+$/, '')}/api/chat`).pipe(
      HttpClientRequest.bodyJsonUnsafe(requestBody(call.options, settings, call.stream)),
      conn.apiKey !== undefined && conn.apiKey !== ''
        ? HttpClientRequest.bearerToken(conn.apiKey)
        : (self: HttpClientRequest.HttpClientRequest) => self
    )
    const response = yield* Effect.mapError(client.execute(request), transportError(call.method))
    if (response.status < 200 || response.status >= 300) {
      return yield* statusError(call.method, response)
    }
    return { response, model: settings.model }
  })

/** A streamed reply as stream parts, line by line. */
const streamParts = (
  response: HttpClientResponse.HttpClientResponse,
  model: string
): Stream.Stream<Response.StreamPartEncoded, AiError.AiError> =>
  response.stream.pipe(
    Stream.mapError(transportError('streamText')),
    Stream.decodeText(),
    Stream.splitLines,
    Stream.filter((text) => text.trim().length > 0),
    Stream.mapEffect((text) =>
      Effect.try({
        try: () => JSON.parse(text) as OllamaChatLine,
        catch: () => malformed('streamText'),
      })
    ),
    Stream.mapAccum(
      (): LineState => ({ started: false, toolCalls: 0 }),
      (state, line) => {
        const next = lineStreamParts(line, state, model)
        return [next.state, next.parts] as const
      }
    )
  )

/**
 * Build the native Ollama `LanguageModel` over the bounded client in context.
 */
export const makeOllamaLanguageModel = (
  conn: OllamaConnection
): Effect.Effect<LanguageModel.LanguageModel, never, HttpClient.HttpClient> =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient
    return yield* LanguageModel.make({
      generateText: (options) =>
        Effect.gen(function* () {
          const { response, model } = yield* sendChat(conn, client, {
            options,
            stream: false,
            method: 'generateText',
          })
          const line = yield* Effect.mapError(response.json, () => malformed('generateText'))
          return yield* toBufferedParts(line as OllamaChatLine, model)
        }),
      streamText: (options) =>
        Stream.unwrap(
          Effect.map(
            sendChat(conn, client, { options, stream: true, method: 'streamText' }),
            ({ response, model }) => streamParts(response, model)
          )
        ),
    })
  })
