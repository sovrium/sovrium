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
  type ChatInput,
  type ChatReply,
  type ChatChunk,
  type AiError,
} from '@/application/ports/services/ai-service'
import { resolveAiEcoRouting, resolveOllamaBaseUrl } from '@/domain/models/env/ai-eco-routing'
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
 *   (`specs/containers/ai-server/server.ts`) and the existing
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

interface ChatCompletionPayload {
  readonly choices?: ReadonlyArray<{
    readonly message?: { readonly content?: string | null }
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
    messages: input.messages,
    temperature,
    max_tokens: maxTokens,
    ...(input.responseFormat ? { response_format: input.responseFormat } : {}),
    ...extra,
  }
}

const callChatCompletions = (
  conn: ProviderConn,
  input: ChatInput
): Effect.Effect<ChatReply, AiError> =>
  Effect.tryPromise({
    try: async () => {
      const model = input.model ?? conn.defaultModel
      const response = await fetch(`${conn.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${conn.apiKey}`,
        },
        body: JSON.stringify(buildRequestBody(model, conn.defaults, input)),
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

      const payload = (await response.json()) as ChatCompletionPayload
      const content = payload.choices?.[0]?.message?.content
      if (typeof content !== 'string') {
        // eslint-disable-next-line functional/no-throw-statements -- Effect.tryPromise.catch maps thrown values to tagged errors
        throw new AiProviderError({
          statusCode: 502,
          message: 'AI provider returned a malformed chat-completion response',
        })
      }
      return { content, model: payload.model ?? model } satisfies ChatReply
    },
    catch: (cause: unknown): AiError => {
      if (cause instanceof AiProviderError || cause instanceof AiConfigError) {
        return cause
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
  return AiService.of({
    chat: (input: ChatInput) => ollamaChat(conn, input),
    chatStream: (input: ChatInput) => ollamaChatStream(conn, input),
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
  config: ReturnType<typeof parseAiEnvConfig>
): ReturnType<typeof AiService.of> => {
  const { baseUrl, apiKey } = config
  const defaultModel = config.model ?? 'mock-model'
  const defaults: AiDefaults = { temperature: config.temperature, maxTokens: config.maxTokens }
  return AiService.of({
    chat: (input: ChatInput) =>
      baseUrl === undefined || apiKey === undefined
        ? Effect.fail(missingCredentialsError())
        : callChatCompletions({ baseUrl, apiKey, defaultModel, defaults }, input),
    chatStream: (input: ChatInput) =>
      baseUrl === undefined || apiKey === undefined
        ? Stream.fail(missingCredentialsError())
        : openChatStream({ baseUrl, apiKey, defaultModel, defaults }, input),
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
    return makeCloudAdapter(config)
  })
)
