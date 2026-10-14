/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer, Option, Stream } from 'effect'
import { LanguageModel } from 'effect/ai'
import {
  AiService,
  AiConfigError,
  type ChatInput,
  type EmbedInput,
} from '@/application/ports/services/ai-service'
import { StorageService } from '@/application/ports/services/storage-service'
import {
  resolveAiEcoRouting,
  resolveOllamaBaseUrl,
} from '@/domain/models/process-env/ai/ai-eco-routing'
import {
  resolveBaseUrl,
  type SupportedAiProvider,
} from '@/domain/models/process-env/ai/ai-providers'
import { boundedHttpClientLayer } from '@/infrastructure/egress/bounded-http-client'
import { traceAiRequest } from '@/infrastructure/telemetry/ai-request-trace'
import {
  prepareAttachments,
  resolveAttachmentTextLimits,
  type ReadReferencedFile,
} from './attachment-parts'
import {
  DEFAULT_CLOUD_EMBEDDING_MODEL,
  DEFAULT_OLLAMA_EMBEDDING_MODEL,
  embedOllama,
  embedOpenAi,
} from './embed'
import {
  languageModelChat,
  languageModelChatStream,
  type ProviderCall,
} from './language-model-chat'
import { makeOllamaLanguageModel, OllamaCallConfig } from './ollama-language-model'
import { getCachedOllamaReachable } from './ollama-reachability'
import { openAiCompatCall, openAiCompatLanguageModelLayer } from './openai-compat-model'
import { parseAiEnvConfig } from './parse-ai-env-config'

/**
 * AI Service Live adapter.
 *
 * Reads env config, routes each call to a provider (`ECO_AI_PROVIDER_PRECEDENCE`,
 * local-first by default), and speaks to it through an `effect/ai`
 * `LanguageModel`:
 *
 * - a cloud provider through `@effect/ai-openai-compat` at
 *   `${AI_BASE_URL}/chat/completions` — the mock test server
 * speaks the same shape;
 * - Ollama through a Sovrium-written `LanguageModel` on its native `/api/chat`.
 *
 * Both run over the bounded `HttpClient` (`egress/bounded-http-client.ts`).
 * When no provider is configured the adapter is a stub whose calls fail with
 * `AiConfigError`, which routes map onto 503 — the Storage service's
 * no-storage fallback contract.
 */

const notConfiguredError = (): AiConfigError =>
  new AiConfigError({
    message:
      'AI provider not configured. Set AI_PROVIDER (and AI_BASE_URL / AI_API_KEY) to enable AI chat.',
  })

const missingCredentialsError = (): AiConfigError =>
  new AiConfigError({
    message: 'AI_BASE_URL and AI_API_KEY must both be set to call the AI provider.',
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

/** The scope a call's settings ride in to the native Ollama model. */
const ollamaCall =
  (defaultTemperature: number | undefined) =>
  (input: ChatInput, model: string): ProviderCall => {
    const settings = {
      model,
      temperature: input.temperature ?? defaultTemperature ?? DEFAULT_TEMPERATURE,
    }
    return {
      effect: (self) => Effect.provideService(self, OllamaCallConfig, settings),
      stream: (self) => Stream.provideService(self, OllamaCallConfig, settings),
    }
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
 * `ECO_AI_PROVIDER_PRECEDENCE`), on its native `/api/chat` ([internal ref] D4). The
 * configured `AI_API_KEY` (if any) is forwarded as a bearer token — Ollama
 * ignores it, but the E2E mock server uses it for per-test isolation.
 */
const makeOllamaAdapter = (
  ollamaBaseUrl: string,
  config: ReturnType<typeof parseAiEnvConfig>
): ReturnType<typeof AiService.of> => {
  const defaultModel = config.model ?? 'llama3.1'
  const modelLayer = Layer.effect(
    LanguageModel.LanguageModel,
    makeOllamaLanguageModel({
      baseUrl: ollamaBaseUrl,
      apiKey: config.apiKey,
      defaultModel,
      defaultTemperature: config.temperature ?? DEFAULT_TEMPERATURE,
    })
  ).pipe(Layer.provide(boundedHttpClientLayer()))
  const scopeCall = ollamaCall(config.temperature)
  const embeddingModel = process.env.AI_EMBEDDING_MODEL?.trim() || DEFAULT_OLLAMA_EMBEDDING_MODEL
  return AiService.of({
    // Instrument the shared chat seam: `ai.request` child span + duration/count
    // metrics, labeled by the resolved provider (`ollama`), the request's model,
    // and the operation (`chat`) — never prompt text / user ids.
    chat: (input: ChatInput) => {
      const model = input.model ?? defaultModel
      return traceAiRequest(
        'ollama',
        model,
        'chat',
        languageModelChat(input, model, scopeCall(input, model)).pipe(Effect.provide(modelLayer))
      )
    },
    chatStream: (input: ChatInput) => {
      const model = input.model ?? defaultModel
      return languageModelChatStream(input, model, scopeCall(input, model)).pipe(
        Stream.provide(modelLayer)
      )
    },
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
  provider: SupportedAiProvider
): ReturnType<typeof AiService.of> => {
  const { apiKey } = config
  // The same resolver `/api/health` reads, so the reported endpoint and the one
  // calls reach cannot diverge (Mistral's public API is its default).
  const baseUrl = resolveBaseUrl(provider, process.env)
  const defaultModel = config.model ?? 'mock-model'
  const scopeCall = openAiCompatCall({
    temperature: config.temperature ?? DEFAULT_TEMPERATURE,
    maxTokens: config.maxTokens ?? DEFAULT_MAX_TOKENS,
  })
  const modelLayer =
    baseUrl === undefined || apiKey === undefined
      ? undefined
      : openAiCompatLanguageModelLayer({ baseUrl, apiKey, defaultModel })
  const embeddingModel = process.env.AI_EMBEDDING_MODEL?.trim() || DEFAULT_CLOUD_EMBEDDING_MODEL
  return AiService.of({
    // Instrument the shared chat seam: `ai.request` child span + duration/count
    // metrics, labeled by the resolved cloud provider, the request's model, and
    // the operation (`chat`) — never prompt text / user ids / keys.
    chat: (input: ChatInput) => {
      const model = input.model ?? defaultModel
      return traceAiRequest(
        provider,
        model,
        'chat',
        modelLayer === undefined
          ? Effect.fail(missingCredentialsError())
          : languageModelChat(input, model, scopeCall(input, model)).pipe(
              Effect.provide(modelLayer)
            )
      )
    },
    chatStream: (input: ChatInput) => {
      const model = input.model ?? defaultModel
      return modelLayer === undefined
        ? Stream.fail(missingCredentialsError())
        : languageModelChatStream(input, model, scopeCall(input, model)).pipe(
            Stream.provide(modelLayer)
          )
    },
    embed: (input: EmbedInput) =>
      baseUrl === undefined
        ? Effect.fail(missingCredentialsError())
        : embedOpenAi({ baseUrl, apiKey, model: embeddingModel }, input),
    embeddingModel: () => embeddingModel,
    isConfigured: () => true,
  })
}

/** The concrete provider adapter behind the `AiService` tag. */
type AiAdapter = ReturnType<typeof AiService.of>

/**
 * Pick the adapter a routing decision names. Pure — no I/O, no env reads
 * beyond the ones its inputs already carry.
 */
const adapterFor = (
  config: ReturnType<typeof parseAiEnvConfig>,
  ollamaBaseUrl: string | undefined,
  routing: ReturnType<typeof resolveAiEcoRouting>
): AiAdapter => {
  // AI disabled: neither AI_PROVIDER (cloud) nor a usable Ollama endpoint.
  if (routing.resolvedProvider === undefined) return notConfiguredStub()
  if (routing.resolvedProvider === 'ollama' && ollamaBaseUrl !== undefined) {
    return makeOllamaAdapter(ollamaBaseUrl, config)
  }
  // `resolvedProvider` is a non-undefined `SupportedAiProvider` here (the
  // AI-disabled case returned above) — carry it as the seam's `provider` label.
  return makeCloudAdapter(config, routing.resolvedProvider)
}

/**
 * The AI service, with the Ollama reachability probe deferred to FIRST USE.
 *
 * WHY THE LAYER BODY DOES NO I/O (invariant I14). The probe is a network round
 * trip with a hard 2 s timeout, and against a configured-but-down endpoint it
 * always spends the full budget — the slowest case is the one an operator is
 * most likely to be in. Running it inside `Layer.effect` therefore put those
 * 2 s on whatever built the layer: at boot once the layer joined the
 * application composition, and per request while the AI route runners were
 * still rebuilding it. Deferring it is what lets `AiLive` sit in
 * `createAppLayer` at all.
 *
 * The memo in `ollama-reachability.ts` still does the real work — it collapses
 * a burst of concurrent calls onto one round trip and re-probes only when its
 * TTL elapses or `OLLAMA_BASE_URL` moves, which is exactly the invalidation an
 * operator starting Ollama mid-session needs. What changed is only WHEN the
 * first call happens.
 */
export const AiServiceLive = Layer.effect(
  AiService,
  Effect.gen(function* () {
    const config = parseAiEnvConfig()
    const ollamaBaseUrl = resolveOllamaBaseUrl(process.env)
    // The bucket reader a turn's file references resolve through, when the
    // layer that built this one provided storage (`app-layer.ts`); without it a
    // turn carrying a file fails closed (`attachment-parts.ts`).
    const read: Option.Option<ReadReferencedFile> = Option.map(
      yield* Effect.serviceOption(StorageService),
      (storage) => (ref) => storage.download(ref.key, ref.bucket)
    )

    /**
     * The routed adapter and the routing that chose it, resolved on demand.
     * Re-derived per call rather than cached here: the memo behind the probe
     * is already the cache, and going through it is what lets routing catch up
     * with an operator who starts or stops Ollama without restarting the
     * server — and what judges a turn's files against THIS turn's routing.
     */
    // effect-promise: total -- `getCachedOllamaReachable` resolves `false` on every failure mode (DNS, refused, non-2xx, timeout) and never rejects.
    const routed = Effect.map(
      Effect.promise(() => getCachedOllamaReachable(ollamaBaseUrl)),
      (reachable) => {
        const routing = resolveAiEcoRouting(process.env, reachable)
        return { routing, adapter: adapterFor(config, ollamaBaseUrl, routing) }
      }
    )

    /** The turn's input with its files resolved, for the adapter routing chose. */
    const prepared = (input: ChatInput) =>
      Effect.flatMap(routed, ({ routing, adapter }) =>
        Effect.map(
          prepareAttachments(input, routing, read, resolveAttachmentTextLimits(process.env)),
          (ready) => ({ adapter, ready })
        )
      )

    /**
     * The adapter as CONFIGURATION alone describes it — routing resolved as if
     * a configured Ollama endpoint were reachable.
     *
     * `embeddingModel()` and `isConfigured()` are synchronous by the port's
     * shape, so they cannot await the probe; and both are configuration
     * questions rather than reachability ones. `isConfigured()` gates whether
     * the AI-compute listener subscribes at all, and answering "no" because
     * Ollama happened to be down at that instant would disable the pipeline
     * for the process's whole life. `embeddingModel()` only picks which
     * default model name `GET /api/ai/rag/config` reports when
     * `AI_EMBEDDING_MODEL` is unset; the vector dimension is a separate env
     * var, so nothing downstream is decided by it.
     */
    const configuredAdapter = adapterFor(
      config,
      ollamaBaseUrl,
      resolveAiEcoRouting(process.env, true)
    )

    return AiService.of({
      chat: (input: ChatInput) =>
        Effect.flatMap(prepared(input), ({ adapter, ready }) => adapter.chat(ready)),
      chatStream: (input: ChatInput) =>
        Stream.unwrap(
          Effect.map(prepared(input), ({ adapter, ready }) => adapter.chatStream(ready))
        ),
      embed: (input: EmbedInput) => Effect.flatMap(routed, ({ adapter }) => adapter.embed(input)),
      embeddingModel: () => configuredAdapter.embeddingModel(),
      isConfigured: () => configuredAdapter.isConfigured(),
    })
  })
)
