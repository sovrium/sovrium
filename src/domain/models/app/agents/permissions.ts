/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { PermissionValueSchema } from '@/domain/models/app/auth/permissions'

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
    Schema.annotate({
      description: "User type discriminator, always 'agent' for AI agents",
    })
  ),

  /**
   * Who can trigger/invoke this agent (e.g., via chat, API, automations).
   *
   * `'none'` is agent-only: no person may reach the agent, admins included.
   * It is the one value under which an agent may hold `code.runTypescript`.
   */
  trigger: Schema.optional(
    Schema.Union([
      PermissionValueSchema,
      Schema.Literal('none').pipe(
        Schema.annotate({
          description:
            'No person may chat with, call or decide for this agent, admins included. It runs only from the `ai/agent` steps of automations and from its own `schedule`.',
        })
      ),
    ]).pipe(
      Schema.annotate({
        description:
          "Who can trigger this agent: 'all', 'authenticated', a role list such as ['admin', 'member'], or 'none' for an agent only automations and its own schedule run. An admin passes any role list but not 'none'. An agent whose tools include `code.runTypescript` must declare 'none'.",
        defaultNote: 'Any signed-in person may trigger the agent.',
      })
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'AgentPermissions',
    title: 'Agent Permissions',
    description:
      'RBAC integration model for AI agents. Agents are stored as auth.user records with type=agent and inherit role-based permissions.',
  })
)

/** @public */
export type AgentPermissions = Schema.Schema.Type<typeof AgentPermissionsSchema>
