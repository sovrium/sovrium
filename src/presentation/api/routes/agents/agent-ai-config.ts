/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared per-agent AI request configuration resolvers.
 *
 * The agent execution path (`agent-ai-call.ts`) and the agent-bound chat path
 * (`agent-chat.ts`) both resolve the effective model + temperature from the
 * agent's per-agent overrides falling back to env vars. The override-vs-env
 * precedence is shared here; each caller applies its own default policy for
 * an absent temperature (see {@link resolveAgentTemperature}).
 */

import type { Agent } from '@/domain/models/app/agents/agent'

/**
 * Resolve the effective request `model`:
 * 1. the agent's `model` override;
 * 2. the `AI_MODEL` env var;
 *  3. `'mock-model'` — so a model always reaches the wire.
 */
export const resolveAgentModel = (agent: Agent): string =>
  agent.model ?? process.env.AI_MODEL ?? 'mock-model'

/**
 * Resolve the effective request temperature using the shared precedence:
 * 1. the agent's `temperature` override;
 * 2. the `AI_TEMPERATURE` env var;
 *  3. `fallback` — the caller's own default policy when neither is set.
 *
 * Callers that want "send a temperature only when configured" pass
 * `fallback: undefined`; callers that want a temperature always on the wire
 * pass a numeric `fallback`. A non-finite `AI_TEMPERATURE` is ignored.
 *
 * The overload preserves the fallback's nullability in the return type: a
 * numeric fallback yields `number`, an `undefined` fallback yields
 * `number | undefined`.
 */
export function resolveAgentTemperature(agent: Agent, fallback: number): number
export function resolveAgentTemperature(
  agent: Agent,
  fallback: number | undefined
): number | undefined
export function resolveAgentTemperature(
  agent: Agent,
  fallback: number | undefined
): number | undefined {
  if (agent.temperature !== undefined) return agent.temperature
  const envTemp = process.env.AI_TEMPERATURE
  if (envTemp !== undefined) {
    const parsed = Number(envTemp)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}
