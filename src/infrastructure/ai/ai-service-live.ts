/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


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

const DEFAULT_TEMPERATURE = 0.7

const DEFAULT_MAX_TOKENS = 4096

interface AiDefaults {
  readonly temperature: number | undefined
  readonly maxTokens: number | undefined
}

interface ProviderConn {
  readonly baseUrl: string
  readonly apiKey: string
  readonly defaultModel: string
  readonly defaults: AiDefaults
}

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

const isAbortTimeout = (cause: unknown): boolean =>
  cause instanceof Error && (cause.name === 'TimeoutError' || cause.name === 'AbortError')

const timeoutError = (timeoutMs: number | undefined): AiTimeoutError =>
  new AiTimeoutError({
    message: 'AI provider request timed out before a response was received.',
    timeoutMs: timeoutMs ?? 0,
  })

const parseChatResponse = async (
  response: Response,
  model: string,
  input: ChatInput,
  signal: AbortSignal | undefined
): Promise<ChatReply> => {
  const payload = await response.json().catch((bodyErr: unknown) => {
    if (signal?.aborted === true) throw timeoutError(input.timeoutMs)
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
  if (typeof content !== 'string' && toolCalls === undefined) {
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
      const signal =
        input.timeoutMs !== undefined ? AbortSignal.timeout(input.timeoutMs) : undefined
      const response = await fetch(`${conn.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${conn.apiKey}`,
        },
        body: JSON.stringify(buildRequestBody(model, conn.defaults, input)),
        ...(signal !== undefined ? { signal } : {}),
      })

      if (!response.ok) {
        const body = await response.text().catch(() => '')
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
    throw new AiProviderError({
      statusCode: response.status,
      message: `AI provider returned HTTP ${String(response.status)}: ${body.slice(0, 200)}`,
    })
  }
  if (response.body === null) {
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
  AiService.of({
    chat: (_input: ChatInput) => Effect.fail(notConfiguredError()),
    chatStream: (_input: ChatInput) => Stream.fail(notConfiguredError()),
    embed: (_input: EmbedInput) => Effect.fail(notConfiguredError()),
    embeddingModel: () => process.env.AI_EMBEDDING_MODEL?.trim() || DEFAULT_CLOUD_EMBEDDING_MODEL,
    isConfigured: () => false,
  })

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
    chat: (input: ChatInput) => ollamaChat(conn, input),
    chatStream: (input: ChatInput) => ollamaChatStream(conn, input),
    embed: (input: EmbedInput) =>
      embedOllama({ baseUrl: ollamaBaseUrl, apiKey: config.apiKey, model: embeddingModel }, input),
    embeddingModel: () => embeddingModel,
    isConfigured: () => true,
  })
}

const makeCloudAdapter = (
  config: ReturnType<typeof parseAiEnvConfig>
): ReturnType<typeof AiService.of> => {
  const { baseUrl, apiKey } = config
  const defaultModel = config.model ?? 'mock-model'
  const defaults: AiDefaults = { temperature: config.temperature, maxTokens: config.maxTokens }
  const embeddingModel = process.env.AI_EMBEDDING_MODEL?.trim() || DEFAULT_CLOUD_EMBEDDING_MODEL
  return AiService.of({
    chat: (input: ChatInput) =>
      baseUrl === undefined || apiKey === undefined
        ? Effect.fail(missingCredentialsError())
        : callChatCompletions({ baseUrl, apiKey, defaultModel, defaults }, input),
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
    const ollamaReachable = yield* Effect.promise(() => probeOllamaReachable(ollamaBaseUrl))
    const routing = resolveAiEcoRouting(process.env, ollamaReachable)

    if (routing.resolvedProvider === undefined) return notConfiguredStub()

    if (routing.resolvedProvider === 'ollama' && ollamaBaseUrl !== undefined) {
      return makeOllamaAdapter(ollamaBaseUrl, config)
    }
    return makeCloudAdapter(config)
  })
)
