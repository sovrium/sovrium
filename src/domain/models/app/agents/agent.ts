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

export const AgentSchema = Schema.Struct({
  ...AgentDefinitionSchema.fields,

  approval: Schema.optional(AgentApprovalSchema),

  tools: Schema.optional(AgentCapabilitiesSchema),

  limits: Schema.optional(AgentLimitsSchema),

  memory: Schema.optional(AgentMemorySchema),

  permissions: Schema.optional(AgentPermissionsSchema),

  schedule: Schema.optional(AgentScheduleSchema),

  knowledge: Schema.optional(AgentKnowledgeSchema),

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

export const AgentsSchema = Schema.Array(AgentSchema).pipe(
  Schema.minItems(1),
  Schema.annotations({
    identifier: 'Agents',
    title: 'Agents Configuration',
    description:
      'Array of AI agent configurations. At least one agent must be defined when the agents property is present.',
  })
)

export type Agents = Schema.Schema.Type<typeof AgentsSchema>
