/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { DEFAULT_AGENT_NAME, isDefaultAgentName } from '@/domain/models/app/agents/agent-identity'
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
  Schema.annotate({
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
  Schema.check(
    // The reservation is checked HERE, on the array, rather than on the name
    // inside `AgentDefinitionSchema`: `default` is legal kebab-case, so the
    // per-name pattern has no business rejecting it, and the collision it
    // creates is a collision with a set — the virtual `agent_name IS NULL`
    // view — not with any other declaration. A declared `default` would carry
    // rows stamped `agent_name = 'default'` while that virtual view carries
    // NULL rows: two different row sets behind one name and one URL. See
    // `src/domain/models/app/agents/agent-identity.ts`.
    //
    // ORDER IS LOAD-BEARING: it precedes `isMinLength`. The trailing
    // `Schema.annotate` below lands on the LAST check, and a `makeFilter` has
    // no JSON Schema representation, so a filter in final position swallows the
    // title + description and the PUBLISHED schema
    // (`apps/website/public/schema/app.json`) silently loses them — measured,
    // not assumed. Keeping a representable check last preserves them.
    Schema.makeFilter((agents) =>
      agents.some((agent) => isDefaultAgentName(agent.name))
        ? `Agent name '${DEFAULT_AGENT_NAME}' is reserved for the general-purpose agent (the conversations no declared agent claimed). Rename this agent.`
        : undefined
    ),
    Schema.isMinLength(1)
  ),
  Schema.annotate({
    identifier: 'Agents',
    title: 'Agents Configuration',
    description:
      'Array of AI agent configurations. At least one agent must be defined when the agents property is present. The name `default` is reserved for the general-purpose agent.',
  })
)

/** @public */
export type Agents = Schema.Schema.Type<typeof AgentsSchema>
