/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { isoDateTime } from '@/domain/models/api/combinators/formats'
import { optionalField } from '@/domain/models/api/combinators/optional-field'
import { speechHealthStatusSchema } from '@/domain/models/api/health/speech-health'
import {
  resolveAiEcoRouting,
  type AiEcoRouting,
} from '@/domain/models/process-env/ai/ai-eco-routing'
import {
  computeAiModelWarnings,
  type AgentModelOverride,
} from '@/domain/models/process-env/ai/ai-model-warnings'
import {
  defaultModelForProvider,
  isSupportedAiProvider,
  resolveAiProvider,
  resolveBaseUrl,
} from '@/domain/models/process-env/ai/ai-providers'

/**
 * Health check response schema
 *
 * Defines the shape of the health check API response.
 * This schema is shared between:
 * - Regular Hono routes (for runtime validation and RPC typing)
 * - OpenAPI schema generation (for API documentation)
 */
/**
 * AI subsystem status reported by the health endpoint.
 *
 * `status` is `'configured'` when the `AI_PROVIDER` env var is set to a
 * recognised provider, `'not_configured'` otherwise. When configured, the
 * provider identifier, default model, and (for self-hosted / compatible
 * endpoints) the base URL are surfaced for operator visibility. Secrets
 * (API keys) are never included.
 */
/**
 * AI-compute two-phase descriptor.
 *
 * AI-compute fields are always available because the deterministic baseline is
 * the guaranteed floor on both database dialects, so `enabled` is always `true`
 * and `mode` is the constant `'baseline-then-refined'`. `refinement` reflects
 * whether an AI provider is configured/usable: `'on'` means the baseline is
 * later refined by the provider, `'off'` means the baseline is the final value.
 * The retired per-engine descriptor (`sqlite-heuristic` / `postgres-trigger`)
 * is intentionally absent.
 */
export const aiComputeHealthSchema = Schema.Struct({
  enabled: Schema.Boolean.annotate({
    description: 'AI-compute availability (always true — baseline is the floor)',
  }),
  mode: Schema.Literal('baseline-then-refined').annotate({ description: 'Two-phase compute mode' }),
  refinement: Schema.Literals(['on', 'off']).annotate({
    description: 'Whether a configured provider refines the deterministic baseline',
  }),
})

export type AiComputeHealth = typeof aiComputeHealthSchema.Type

export const aiHealthStatusSchema = Schema.Struct({
  status: Schema.Literals(['configured', 'not_configured']).annotate({
    description: 'Whether an AI provider is configured via AI_PROVIDER',
  }),
  compute: aiComputeHealthSchema.annotate({ description: 'AI-compute two-phase descriptor' }),
  provider: optionalField(
    Schema.String.annotate({ description: 'Configured AI provider identifier (AI_PROVIDER)' })
  ),
  model: optionalField(
    Schema.String.annotate({ description: 'Default AI model identifier (AI_MODEL)' })
  ),
  endpoint: optionalField(
    Schema.String.annotate({ description: 'AI provider base URL (AI_BASE_URL), when applicable' })
  ),
  warnings: optionalField(
    Schema.Array(Schema.String).annotate({
      description:
        'Non-fatal AI configuration warnings surfaced at startup (e.g. unknown model names)',
    })
  ),
  // ── Eco-conception provider routing (ECO_AI_PROVIDER_PRECEDENCE) ──────────
  precedence: optionalField(
    Schema.Literals(['local-first', 'cloud-first', 'local-only']).annotate({
      description: 'Active ECO_AI_PROVIDER_PRECEDENCE routing mode',
    })
  ),
  resolvedProvider: optionalField(
    Schema.String.annotate({
      description: 'Provider AI calls are actually routed to (after applying eco precedence)',
    })
  ),
  ollamaReachable: optionalField(
    Schema.Boolean.annotate({
      description: 'Whether the local Ollama reachability probe succeeded',
    })
  ),
  configured: optionalField(
    Schema.String.annotate({
      description: 'Provider declared via AI_PROVIDER (distinct from resolvedProvider)',
    })
  ),
  fallbackReason: optionalField(
    Schema.String.annotate({
      description: 'Why the eco resolver fell back to a non-preferred provider',
    })
  ),
})

export type AiHealthStatus = typeof aiHealthStatusSchema.Type

export const healthResponseSchema = Schema.Struct({
  status: Schema.Literal('ok').annotate({ description: 'Server health status indicator' }),
  timestamp: isoDateTime({ description: 'ISO 8601 timestamp of the health check' }),
  app: Schema.Struct({
    name: Schema.String.annotate({ description: 'Application name from configuration' }),
  }).annotate({ description: 'Application metadata' }),
  ai: aiHealthStatusSchema.annotate({ description: 'AI subsystem status' }),
  speech: optionalField(
    speechHealthStatusSchema.annotate({ description: 'Speech-to-text subsystem status' })
  ),
})

/**
 * TypeScript type inferred from Zod schema
 *
 * Use this type for type-safe health check responses in application code.
 */
export type HealthResponse = typeof healthResponseSchema.Type

/**
 * Build the `ai` health-status object from a snapshot of env vars.
 *
 * Pure function (takes `processEnv` so it stays trivially testable). When
 * `AI_PROVIDER` is unset or unrecognised, AI is reported as not configured;
 * a recognised provider yields `'configured'` plus the provider/model/endpoint
 * for operator visibility. API keys are intentionally never surfaced.
 */
/**
 * Resolve the active model to surface: an explicitly-set `AI_MODEL` wins,
 * otherwise the canonical provider's current default (which may itself be
 * `undefined` for providers without a universal default, e.g.
 * `openai-compatible`).
 */
const resolveActiveModel = (
  canonicalProvider: ReturnType<typeof resolveAiProvider>,
  explicitModel: string | undefined
): string | undefined =>
  explicitModel ?? (canonicalProvider ? defaultModelForProvider(canonicalProvider) : undefined)

const buildConfiguredAiHealthStatus = (
  rawProvider: string,
  processEnv: Readonly<Record<string, string | undefined>>,
  agents: ReadonlyArray<AgentModelOverride>
): Readonly<AiHealthStatus> => {
  const canonicalProvider = resolveAiProvider(rawProvider)
  const explicitModel = processEnv['AI_MODEL']?.trim() || undefined
  const model = resolveActiveModel(canonicalProvider, explicitModel)
  // Resolve the endpoint via the provider-specific alias (e.g. `OLLAMA_BASE_URL`)
  // so a base URL configured only via the alias is still surfaced.
  const endpoint = canonicalProvider
    ? resolveBaseUrl(canonicalProvider, processEnv)
    : processEnv['AI_BASE_URL']?.trim() || undefined
  // Warnings are about *explicitly* configured models — a resolved default is
  // by definition a known model, so pass `explicitModel` here.
  const warnings = canonicalProvider
    ? computeAiModelWarnings(canonicalProvider, explicitModel, agents)
    : []
  return {
    status: 'configured',
    provider: rawProvider,
    ...(model ? { model } : {}),
    ...(endpoint ? { endpoint } : {}),
    ...(warnings.length > 0 ? { warnings: [...warnings] } : {}),
    compute: aiComputeHealth(true),
  }
}

/**
 * Build the AI-compute two-phase descriptor. AI-compute is always enabled (the
 * deterministic baseline is the guaranteed floor); `refinement` is `'on'` when
 * a provider is configured/usable so the baseline gets refined, `'off'`
 * otherwise (the baseline is then the final value).
 */
const aiComputeHealth = (providerConfigured: boolean): Readonly<AiComputeHealth> => ({
  enabled: true,
  mode: 'baseline-then-refined',
  refinement: providerConfigured ? 'on' : 'off',
})

/**
 * The startup/health warning surfaced when an app declares `agents:` but no AI
 * provider is resolvable. Names the missing env var AND states the
 * agents are inert so an operator can self-serve the fix. The same message is
 * logged at WARN at startup. Empty array when no agents are declared (nothing
 * degrades, so nothing to warn about).
 */
const inertAgentWarnings = (agentCount: number): ReadonlyArray<string> =>
  agentCount > 0
    ? [
        'AI_PROVIDER is not set — AI agents are inert (declared but not runnable). Set AI_PROVIDER to a supported provider to enable them.',
      ]
    : []

export const buildAiHealthStatus = (
  processEnv: Readonly<Record<string, string | undefined>>,
  agents: ReadonlyArray<AgentModelOverride> = []
): Readonly<AiHealthStatus> => {
  const rawProvider = processEnv['AI_PROVIDER']?.trim()
  if (rawProvider === undefined || rawProvider === '' || !isSupportedAiProvider(rawProvider)) {
    const warnings = inertAgentWarnings(agents.length)
    return {
      status: 'not_configured',
      compute: aiComputeHealth(false),
      ...(warnings.length > 0 ? { warnings: [...warnings] } : {}),
    }
  }
  return buildConfiguredAiHealthStatus(rawProvider, processEnv, agents)
}

/**
 * Project an {@link AiEcoRouting} decision onto the `body.ai` health surface:
 * `precedence`, `resolvedProvider`, `ollamaReachable`, `configured`, and
 * `fallbackReason` (when present). Empty fields are omitted so the response
 * stays minimal.
 */
const ecoRoutingFields = (routing: AiEcoRouting): Readonly<Partial<AiHealthStatus>> => ({
  precedence: routing.precedence,
  ...(routing.resolvedProvider ? { resolvedProvider: routing.resolvedProvider } : {}),
  ollamaReachable: routing.ollamaReachable,
  ...(routing.configured ? { configured: routing.configured } : {}),
  ...(routing.fallbackReason ? { fallbackReason: routing.fallbackReason } : {}),
})

/**
 * Build the full `body.ai` health object: the base `AI_PROVIDER`-derived
 * status plus the `ECO_AI_PROVIDER_PRECEDENCE` routing decision. The Ollama
 * reachability result is supplied by the caller (the route handler performs
 * the async probe), keeping this function pure.
 */
export const buildAiHealthStatusWithEcoRouting = (
  processEnv: Readonly<Record<string, string | undefined>>,
  ollamaReachable: boolean,
  agents: ReadonlyArray<AgentModelOverride> = []
): Readonly<AiHealthStatus> => ({
  ...buildAiHealthStatus(processEnv, agents),
  ...ecoRoutingFields(resolveAiEcoRouting(processEnv, ollamaReachable)),
})
