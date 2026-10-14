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
 * (`agents/agent-chat.ts`) share the override-vs-env PRECEDENCE; each applies
 * its own default policy for an absent temperature (see
 * {@link resolveAgentTemperature}).
 *
 * There is no shared MODEL resolver: every agent call goes through the
 * `AiService` port, where an absent model means "use the provider's own
 * default" (`AI_MODEL`, else `llama3.1` on Ollama).
 */

import type { Agent } from '@/domain/models/app/agents/agent'

/**
 * Resolve the effective request temperature using the shared precedence:
 *  1. the agent's `temperature` override;
 *  2. the `AI_TEMPERATURE` env var;
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
