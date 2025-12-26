/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import {
  ResourceActionPermissionsSchema,
  UserLevelRoleSchema,
} from '@/domain/models/app/permissions'

/**
 * Role Management Configuration
 *
 * Controls admin role assignment and revocation capabilities.
 * Presence of this config enables role management features.
 */
export const RoleManagementSchema = Schema.Struct({
  assignAdmin: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({ description: 'Allow admins to grant admin role to users' })
    )
  ),
  revokeAdmin: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({ description: 'Allow admins to revoke admin role from users' })
    )
  ),
  preventSelfRevocation: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({ description: 'Prevent admins from revoking their own admin role' })
    )
  ),
}).pipe(
  Schema.annotations({
    title: 'Role Management',
    description: 'Admin role assignment and revocation capabilities',
    examples: [{ assignAdmin: true, revokeAdmin: true, preventSelfRevocation: true }],
  })
)

export type RoleManagement = Schema.Schema.Type<typeof RoleManagementSchema>

/**
 * Admin Plugin Configuration
 *
 * Enables administrative features for user management.
 * Includes capabilities for managing roles, impersonating users,
 * and custom permissions.
 *
 * Configuration options:
 * - impersonation: Allow admins to impersonate other users
 * - userManagement: Enable user CRUD operations
 * - firstUserAdmin: Make first registered user an admin
 * - defaultRole: Default role for new users
 * - listUsers/setUserRole: User lifecycle operations
 * - customPermissions: Granular resource:action permissions
 * - roleManagement: Admin role assignment/revocation
 *
 * Default admin user is configured via environment variables:
 * - ADMIN_EMAIL: Admin email address
 * - ADMIN_PASSWORD: Admin password
 * - ADMIN_NAME: Admin display name (optional)
 *
 * @example
 * ```typescript
 * // Simple enable
 * { plugins: { admin: true } }
 *
 * // With configuration
 * { plugins: { admin: { impersonation: true, firstUserAdmin: true } } }
 *
 * // With custom permissions
 * { plugins: { admin: {
 *   customPermissions: {
 *     posts: ['create', 'read', 'update', 'delete'],
 *     analytics: ['read']
 *   }
 * } } }
 * ```
 */
export const AdminConfigSchema = Schema.Union(
  Schema.Boolean,
  Schema.Struct({
    // ========== Existing Fields ==========
    impersonation: Schema.optional(
      Schema.Boolean.pipe(Schema.annotations({ description: 'Allow admin impersonation of users' }))
    ),
    userManagement: Schema.optional(
      Schema.Boolean.pipe(Schema.annotations({ description: 'Enable user management features' }))
    ),

    // ========== Admin Options ==========
    firstUserAdmin: Schema.optional(
      Schema.Boolean.pipe(
        Schema.annotations({ description: 'Automatically make the first registered user an admin' })
      )
    ),
    defaultRole: Schema.optional(
      UserLevelRoleSchema.pipe(
        Schema.annotations({
          description: 'Default role assigned to new users',
          message: () => 'Invalid default role. Must be one of: admin, user, viewer',
        })
      )
    ),

    // ========== User Lifecycle Operations ==========
    listUsers: Schema.optional(
      Schema.Boolean.pipe(Schema.annotations({ description: 'Enable user listing functionality' }))
    ),
    setUserRole: Schema.optional(
      Schema.Boolean.pipe(
        Schema.annotations({ description: 'Enable role assignment functionality' })
      )
    ),

    // ========== Advanced Features ==========
    customPermissions: Schema.optional(ResourceActionPermissionsSchema),
    roleManagement: Schema.optional(RoleManagementSchema),
  })
).pipe(
  Schema.annotations({
    title: 'Admin Plugin Configuration',
    description:
      'Administrative features for user management. Default admin user configured via ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME environment variables.',
    examples: [
      true,
      { impersonation: true },
      { impersonation: true, userManagement: true, firstUserAdmin: true },
      {
        customPermissions: { posts: ['create', 'read', 'update', 'delete'] },
        roleManagement: { assignAdmin: true, revokeAdmin: true },
      },
    ],
  })
)

export type AdminConfig = Schema.Schema.Type<typeof AdminConfigSchema>
