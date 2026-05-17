/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { PermissionValueSchema } from '@/domain/models/shared/permissions'

/**
 * AgentPermissionsSchema describes how an agent integrates with the RBAC system
 * via the auth.user table.
 *
 * Each agent is stored as a user record with `type: 'agent'` and a synthetic
 * email address (`{name}@agents.sovrium.local`). The agent inherits all
 * table/field permissions of its assigned role, just like a human user.
 *
 * This schema captures the agent-as-user storage model for documentation and
 * validation purposes. The actual auth.user records are managed at runtime
 * (created on first startup, updated when role changes, soft-deleted when
 * agent is removed from config).
 *
 * Key behaviors:
 * - Agents cannot authenticate via login endpoints (email/password, magic link, etc.)
 * - Agent actions appear in activity log with `actor.type = 'agent'`
 * - Agent users are excluded from user list by default (filter: type != agent)
 * - Agent users are included when `?includeAgents=true` query parameter is passed
 */
export const AgentPermissionsSchema = Schema.Struct({
  /** User type discriminator — always 'agent' for AI agents */
  type: Schema.Literal('agent').pipe(
    Schema.annotations({
      description: "User type discriminator — always 'agent' for AI agents",
    })
  ),

  /** Who can trigger/invoke this agent (e.g., via chat, API, automations) */
  trigger: Schema.optional(
    PermissionValueSchema.pipe(
      Schema.annotations({
        description:
          "Who can trigger this agent. 'all', 'authenticated', or role array ['admin', 'member'].",
      })
    )
  ),

  /** Synthetic email for the agent user record ({name}@agents.sovrium.local) */
  emailDomain: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description:
          "Domain for synthetic agent email addresses (defaults to 'agents.sovrium.local')",
      })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'AgentPermissions',
    title: 'Agent Permissions',
    description:
      'RBAC integration model for AI agents. Agents are stored as auth.user records with type=agent and inherit role-based permissions.',
  })
)

/** @public */
export type AgentPermissions = Schema.Schema.Type<typeof AgentPermissionsSchema>
