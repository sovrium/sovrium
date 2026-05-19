/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const AgentActionSchema = Schema.Literal(
  'record.read',
  'record.create',
  'record.update',
  'record.delete',
  'state.get',
  'state.set',
  'state.increment',
  'state.delete',
  'state.list',
  'http.request',
  'ai.generate',
  'ai.classify',
  'ai.extract',
  'code.runTypescript',
  'email.send',
  'auth.createUser',
  'auth.assignRole',
  'auth.banUser',
  'auth.unbanUser',
  'file.upload',
  'file.download',
  'file.delete',
  'file.list',
  'file.getMetadata'
).pipe(
  Schema.annotations({
    description: 'Action type the agent can perform (type.operator format)',
  })
)

export type AgentAction = Schema.Schema.Type<typeof AgentActionSchema>

export const AgentCapabilitiesSchema = Schema.Struct({
  tables: Schema.Array(
    Schema.String.pipe(
      Schema.minLength(1),
      Schema.annotations({ description: 'Table name the agent can access' })
    )
  ).pipe(
    Schema.minItems(1),
    Schema.annotations({
      description: 'Table names the agent can access (must reference tables defined in the schema)',
      examples: [['tickets', 'customers']],
    })
  ),

  actions: Schema.Array(AgentActionSchema).pipe(
    Schema.minItems(1),
    Schema.annotations({
      description: 'Action types the agent can perform',
      examples: [['record.read', 'record.update']],
    })
  ),
}).pipe(
  Schema.annotations({
    identifier: 'AgentCapabilities',
    title: 'Agent Capabilities',
    description:
      'Tool allowlist defining which tables and actions an agent can access. Implements double-gate security (RBAC + allowlist).',
  })
)

export type AgentCapabilities = Schema.Schema.Type<typeof AgentCapabilitiesSchema>
