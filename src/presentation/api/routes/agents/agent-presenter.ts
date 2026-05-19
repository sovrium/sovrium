/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { resolveAgentLimits } from './agent-limits'
import type { Agent } from '@/domain/models/app/agents/agent'

export const serializeAgent = (agent: Agent): Record<string, unknown> => ({
  name: agent.name,
  role: agent.role,
  systemPrompt: agent.systemPrompt,
  enabled: agent.enabled ?? true,
  ...(agent.model !== undefined && { model: agent.model }),
  ...(agent.temperature !== undefined && { temperature: agent.temperature }),
  ...(agent.maxTokens !== undefined && { maxTokens: agent.maxTokens }),
  ...(agent.instructions !== undefined && { instructions: agent.instructions }),
  ...(agent.approval !== undefined && { approval: agent.approval }),
  ...(agent.tools !== undefined && { tools: agent.tools }),
  limits: resolveAgentLimits(agent.limits),
})
