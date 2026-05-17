/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { AgentApprovalSchema } from './approval'
import { AgentDefinitionSchema } from './definition'
import { AgentKnowledgeSchema } from './knowledge'
import { AgentLimitsSchema } from './limits'
import { AgentMcpSchema } from './mcp'
import { AgentMemorySchema } from './memory'
import { AgentPermissionsSchema } from './permissions'
import { AgentScheduleSchema } from './schedule'
import { AgentCapabilitiesSchema } from './tools'

/**
 * AgentSchema composes all agent sub-schemas into a single configuration.
 *
 * The definition properties (name, role, model, systemPrompt, etc.) are
 * inlined directly at the top level. Optional sub-configs (approval, tools,
 * limits, permissions, schedule) are nested under their respective keys.
 *
 * Requires `auth` to be configured in the app schema and `AI_PROVIDER` env var to be set.
 */
export const AgentSchema = Schema.Struct({
  ...AgentDefinitionSchema.fields,

  /** Human-in-the-loop approval workflow configuration */
  approval: Schema.optional(AgentApprovalSchema),

  /** Tool allowlist defining which tables and actions the agent can access */
  tools: Schema.optional(AgentCapabilitiesSchema),

  /** Rate limits, token budgets, and concurrency caps */
  limits: Schema.optional(AgentLimitsSchema),

  /** Memory configuration (conversation history, knowledge retrieval, learned facts) */
  memory: Schema.optional(AgentMemorySchema),

  /** RBAC integration model (agent-as-user storage) */
  permissions: Schema.optional(AgentPermissionsSchema),

  /** Periodic execution configuration using cron expressions */
  schedule: Schema.optional(AgentScheduleSchema),

  /** Knowledge data sources to embed for RAG-based retrieval */
  knowledge: Schema.optional(AgentKnowledgeSchema),

  /** MCP client configuration for external tool servers */
  mcp: Schema.optional(AgentMcpSchema),
}).pipe(
  Schema.annotations({
    identifier: 'Agent',
    title: 'Agent Configuration',
    description:
      'Complete AI agent configuration including identity, model parameters, approval workflows, tool access, limits, permissions, and scheduling.',
  })
)

export type Agent = Schema.Schema.Type<typeof AgentSchema>

/**
 * AgentsSchema is an array of agent configurations.
 *
 * Used as the type for the `agents` property on AppSchema.
 */
export const AgentsSchema = Schema.Array(AgentSchema).pipe(
  Schema.minItems(1),
  Schema.annotations({
    identifier: 'Agents',
    title: 'Agents Configuration',
    description:
      'Array of AI agent configurations. At least one agent must be defined when the agents property is present.',
  })
)

/** @public */
export type Agents = Schema.Schema.Type<typeof AgentsSchema>
