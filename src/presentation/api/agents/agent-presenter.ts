/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Presentation transforms for agent configuration readback.
 *
 * `serializeAgent` shapes a domain {@link Agent} into the JSON contract read
 * by `GET /api/agents` and `GET /api/agents/:name`. Kept separate from the
 * route handlers so the route module stays focused on request orchestration.
 */

import { resolveAgentLimits } from './agent-limits'
import type { Agent } from '@/domain/models/app/agents/agent'

/** Serialize an agent's configuration for API readback. */
export const serializeAgent = (agent: Agent): Record<string, unknown> => ({
  name: agent.name,
  role: agent.role,
  systemPrompt: agent.systemPrompt,
  // `enabled` defaults to true when omitted.
  enabled: agent.enabled ?? true,
  ...(agent.model !== undefined && { model: agent.model }),
  ...(agent.temperature !== undefined && { temperature: agent.temperature }),
  ...(agent.maxTokens !== undefined && { maxTokens: agent.maxTokens }),
  ...(agent.instructions !== undefined && { instructions: agent.instructions }),
  ...(agent.approval !== undefined && { approval: agent.approval }),
  ...(agent.tools !== undefined && { tools: agent.tools }),
  // [internal ref]: `limits` is always reported with defaults
  // merged in, so a caller sees the agent's effective operational limits
  // even when the `limits` section was omitted from the schema.
  limits: resolveAgentLimits(agent.limits),
})
