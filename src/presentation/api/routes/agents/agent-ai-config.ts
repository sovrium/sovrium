/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import type { Agent } from '@/domain/models/app/agents/agent'

export const resolveAgentModel = (agent: Agent): string =>
  agent.model ?? process.env.AI_MODEL ?? 'mock-model'

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
