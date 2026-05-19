/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { PermissionValueSchema } from '@/domain/models/shared/permissions'

export const AgentPermissionsSchema = Schema.Struct({
  type: Schema.Literal('agent').pipe(
    Schema.annotations({
      description: "User type discriminator — always 'agent' for AI agents",
    })
  ),

  trigger: Schema.optional(
    PermissionValueSchema.pipe(
      Schema.annotations({
        description:
          "Who can trigger this agent. 'all', 'authenticated', or role array ['admin', 'member'].",
      })
    )
  ),

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

export type AgentPermissions = Schema.Schema.Type<typeof AgentPermissionsSchema>
