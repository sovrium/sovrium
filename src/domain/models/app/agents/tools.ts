/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Supported agent action types.
 *
 * These define what operations an agent can perform autonomously.
 * Each entry follows the `type.operator` pattern from the automation action schema.
 *
 * Categories:
 * - **Record**: CRUD on allowed tables. `record.read` and `record.list` are two
 *   distinct capabilities, not one granted twice: `read` fetches a single row by
 *   primary key, `list` returns a filtered / ordered / bounded set. Granting
 *   `read` alone therefore deliberately withholds the ability to sweep a table,
 *   which is why `list` is its own grant rather than a mode of `read`.
 * - **State**: Cross-run key-value persistence
 * - **HTTP**: External API calls
 * - **AI**: Chain LLM sub-tasks (generate, classify, extract)
 * - **Code**: Execute sandboxed TypeScript
 * - **Email**: Send emails via configured SMTP
 * - **Auth**: User management operations
 * - **File**: File storage operations
 */
export const AgentActionSchema = Schema.Literals(
  // Record operations
  [
    'record.read',
    'record.list',
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
    'file.getMetadata',
  ]
).pipe(
  Schema.annotate({
    description: 'Action type the agent can perform (type.operator format)',
  })
)

/** @public */
export type AgentAction = Schema.Schema.Type<typeof AgentActionSchema>

/**
 * AgentCapabilitiesSchema defines the tool allowlist for an agent.
 *
 * This implements a double-gate security model:
 * 1. RBAC gate: Does the agent's role have permission for this table/action?
 * 2. Allowlist gate: Is this table/action in the agent's capabilities?
 *
 * Both gates must pass. An agent without capabilities has NO access (secure by default).
 */
export const AgentCapabilitiesSchema = Schema.Struct({
  /** Table names the agent can access (must reference tables defined in the schema) */
  tables: Schema.Array(
    Schema.String.pipe(
      Schema.check(Schema.isMinLength(1)),
      Schema.annotate({ description: 'Table name the agent can access' })
    )
  ).pipe(
    Schema.check(Schema.isMinLength(1)),
    Schema.annotate({
      description: 'Table names the agent can access (must reference tables defined in the schema)',
      examples: [['tickets', 'customers']],
    })
  ),

  /** Action types the agent can perform */
  actions: Schema.Array(AgentActionSchema).pipe(
    Schema.check(Schema.isMinLength(1)),
    Schema.annotate({
      description: 'Action types the agent can perform',
      examples: [['record.read', 'record.update']],
    })
  ),
}).pipe(
  Schema.annotate({
    identifier: 'AgentCapabilities',
    title: 'Agent Capabilities',
    description:
      'Tool allowlist defining which tables and actions an agent can access. Implements double-gate security (RBAC + allowlist).',
  })
)

/** @public */
export type AgentCapabilities = Schema.Schema.Type<typeof AgentCapabilitiesSchema>
