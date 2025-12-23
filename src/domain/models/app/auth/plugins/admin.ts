/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Custom Permissions Schema (resource:action format)
 *
 * Defines granular permissions using resource:action pattern.
 * Each resource maps to an array of allowed actions.
 *
 * @example
 * ```typescript
 * {
 *   posts: ['create', 'read', 'update', 'delete'],
 *   analytics: ['read'],
 *   media: ['*']  // Wildcard for all actions
 * }
 * ```
 */
export const CustomPermissionsSchema = Schema.Record({
  key: Schema.String.pipe(
    Schema.pattern(/^[a-z][a-z0-9_-]*$/i),
    Schema.annotations({ description: 'Resource name (e.g., "posts", "comments")' })
  ),
  value: Schema.Array(
    Schema.Union(
      Schema.Literal('*'),
      Schema.String.pipe(
        Schema.pattern(/^[a-z][a-z0-9_-]*$/i),
        Schema.annotations({ description: 'Action name (e.g., "create", "read")' })
      )
    )
  ).pipe(
    Schema.minItems(1),
    Schema.annotations({ description: 'Allowed actions for this resource' })
  ),
}).pipe(
  Schema.annotations({
    title: 'Custom Permissions',
    description: 'Resource:action permission definitions',
    examples: [
      {
        posts: ['create', 'read', 'update', 'delete'],
        comments: ['create', 'read', 'delete'],
        media: ['*'],
      },
    ],
  })
)

export type CustomPermissions = Schema.Schema.Type<typeof CustomPermissionsSchema>

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
 * Includes capabilities for banning users, managing roles,
 * impersonating users, and custom permissions.
 *
 * Configuration options:
 * - impersonation: Allow admins to impersonate other users
 * - userManagement: Enable user CRUD operations
 * - firstUserAdmin: Make first registered user an admin
 * - defaultRole: Default role for new users
 * - banUser/unbanUser/deleteUser/listUsers/setUserRole: User lifecycle operations
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
      Schema.Literal('admin', 'user', 'viewer').pipe(
        Schema.annotations({ description: 'Default role assigned to new users' })
      )
    ),

    // ========== User Lifecycle Operations ==========
    banUser: Schema.optional(
      Schema.Boolean.pipe(Schema.annotations({ description: 'Enable user banning functionality' }))
    ),
    unbanUser: Schema.optional(
      Schema.Boolean.pipe(
        Schema.annotations({ description: 'Enable user unbanning functionality' })
      )
    ),
    deleteUser: Schema.optional(
      Schema.Boolean.pipe(Schema.annotations({ description: 'Enable user deletion functionality' }))
    ),
    listUsers: Schema.optional(
      Schema.Boolean.pipe(Schema.annotations({ description: 'Enable user listing functionality' }))
    ),
    setUserRole: Schema.optional(
      Schema.Boolean.pipe(
        Schema.annotations({ description: 'Enable role assignment functionality' })
      )
    ),

    // ========== Advanced Features ==========
    customPermissions: Schema.optional(CustomPermissionsSchema),
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
