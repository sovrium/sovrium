/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from 'zod'
import { resolveAiEcoRouting, type AiEcoRouting } from '@/domain/models/env/ai/ai-eco-routing'
import {
  computeAiModelWarnings,
  type AgentModelOverride,
} from '@/domain/models/env/ai/ai-model-warnings'
import {
  defaultModelForProvider,
  isSupportedAiProvider,
  resolveAiProvider,
  resolveBaseUrl,
} from '@/domain/models/env/ai/ai-providers'

export const aiComputeHealthSchema = z.object({
  enabled: z.boolean().describe('AI-compute availability (always true — baseline is the floor)'),
  mode: z.literal('baseline-then-refined').describe('Two-phase compute mode'),
  refinement: z
    .enum(['on', 'off'])
    .describe('Whether a configured provider refines the deterministic baseline'),
})

export type AiComputeHealth = z.infer<typeof aiComputeHealthSchema>

export const aiHealthStatusSchema = z.object({
  status: z
    .enum(['configured', 'not_configured'])
    .describe('Whether an AI provider is configured via AI_PROVIDER'),
  compute: aiComputeHealthSchema.describe('AI-compute two-phase descriptor (DEC-030 Phase 2)'),
  provider: z.string().optional().describe('Configured AI provider identifier (AI_PROVIDER)'),
  model: z.string().optional().describe('Default AI model identifier (AI_MODEL)'),
  endpoint: z.string().optional().describe('AI provider base URL (AI_BASE_URL), when applicable'),
  warnings: z
    .array(z.string())
    .optional()
    .describe('Non-fatal AI configuration warnings surfaced at startup (e.g. unknown model names)'),
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

export type HealthResponse = z.infer<typeof healthResponseSchema>

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
  const endpoint = canonicalProvider
    ? resolveBaseUrl(canonicalProvider, processEnv)
    : processEnv['AI_BASE_URL']?.trim() || undefined
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

const aiComputeHealth = (providerConfigured: boolean): Readonly<AiComputeHealth> => ({
  enabled: true,
  mode: 'baseline-then-refined',
  refinement: providerConfigured ? 'on' : 'off',
})

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

const ecoRoutingFields = (routing: AiEcoRouting): Readonly<Partial<AiHealthStatus>> => ({
  precedence: routing.precedence,
  ...(routing.resolvedProvider ? { resolvedProvider: routing.resolvedProvider } : {}),
  ollamaReachable: routing.ollamaReachable,
  ...(routing.configured ? { configured: routing.configured } : {}),
  ...(routing.fallbackReason ? { fallbackReason: routing.fallbackReason } : {}),
})

export const buildAiHealthStatusWithEcoRouting = (
  processEnv: Readonly<Record<string, string | undefined>>,
  ollamaReachable: boolean,
  agents: ReadonlyArray<AgentModelOverride> = []
): Readonly<AiHealthStatus> => ({
  ...buildAiHealthStatus(processEnv, agents),
  ...ecoRoutingFields(resolveAiEcoRouting(processEnv, ollamaReachable)),
})
