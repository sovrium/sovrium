/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from 'zod'
import { resolveAiEcoRouting, type AiEcoRouting } from '@/domain/models/env/ai-eco-routing'
import {
  computeAiModelWarnings,
  type AgentModelOverride,
} from '@/domain/models/env/ai-model-warnings'
import {
  defaultModelForProvider,
  isSupportedAiProvider,
  resolveAiProvider,
} from '@/domain/models/env/ai-providers'

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
export const aiHealthStatusSchema = z.object({
  status: z
    .enum(['configured', 'not_configured'])
    .describe('Whether an AI provider is configured via AI_PROVIDER'),
  provider: z.string().optional().describe('Configured AI provider identifier (AI_PROVIDER)'),
  model: z.string().optional().describe('Default AI model identifier (AI_MODEL)'),
  endpoint: z.string().optional().describe('AI provider base URL (AI_BASE_URL), when applicable'),
  warnings: z
    .array(z.string())
    .optional()
    .describe('Non-fatal AI configuration warnings surfaced at startup (e.g. unknown model names)'),
  // ── Eco-conception provider routing (ECO_AI_PROVIDER_PRECEDENCE) ──────────
  precedence: z
    .enum(['local-first', 'cloud-first', 'local-only'])
    .optional()
    .describe('Active ECO_AI_PROVIDER_PRECEDENCE routing mode'),
  resolvedProvider: z
    .string()
    .optional()
    .describe('Provider AI calls are actually routed to (after applying eco precedence)'),
  ollamaReachable: z
    .boolean()
    .optional()
    .describe('Whether the local Ollama reachability probe succeeded'),
  configured: z
    .string()
    .optional()
    .describe('Provider declared via AI_PROVIDER (distinct from resolvedProvider)'),
  fallbackReason: z
    .string()
    .optional()
    .describe('Why the eco resolver fell back to a non-preferred provider'),
})

export type AiHealthStatus = z.infer<typeof aiHealthStatusSchema>

export const healthResponseSchema = z.object({
  status: z.literal('ok').describe('Server health status indicator'),
  timestamp: z.iso
    .datetime({
      offset: true,
      precision: 3,
    })
    .describe('ISO 8601 timestamp of the health check'),
  app: z
    .object({
      name: z.string().describe('Application name from configuration'),
    })
    .describe('Application metadata'),
  ai: aiHealthStatusSchema.describe('AI subsystem status'),
})

/**
 * TypeScript type inferred from Zod schema
 *
 * Use this type for type-safe health check responses in application code.
 */
export type HealthResponse = z.infer<typeof healthResponseSchema>

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
  const endpoint = processEnv['AI_BASE_URL']?.trim() || undefined
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
  }
}

export const buildAiHealthStatus = (
  processEnv: Readonly<Record<string, string | undefined>>,
  agents: ReadonlyArray<AgentModelOverride> = []
): Readonly<AiHealthStatus> => {
  const rawProvider = processEnv['AI_PROVIDER']?.trim()
  if (rawProvider === undefined || rawProvider === '' || !isSupportedAiProvider(rawProvider)) {
    return { status: 'not_configured' }
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
