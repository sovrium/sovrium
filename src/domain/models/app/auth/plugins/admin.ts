/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Admin Plugin Configuration
 *
 * Enables administrative features for user management.
 * Includes capabilities for banning users, managing roles,
 * and impersonating users for debugging.
 *
 * Configuration options:
 * - impersonation: Allow admins to impersonate other users
 * - userManagement: Enable user CRUD operations
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
 * { plugins: { admin: { impersonation: true, userManagement: true } } }
 * ```
 */
export const AdminConfigSchema = Schema.Union(
  Schema.Boolean,
  Schema.Struct({
    impersonation: Schema.optional(
      Schema.Boolean.pipe(Schema.annotations({ description: 'Allow admin impersonation of users' }))
    ),
    userManagement: Schema.optional(
      Schema.Boolean.pipe(Schema.annotations({ description: 'Enable user management features' }))
    ),
  })
).pipe(
  Schema.annotations({
    title: 'Admin Plugin Configuration',
    description:
      'Administrative features for user management. Default admin user configured via ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME environment variables.',
    examples: [true, { impersonation: true }, { impersonation: true, userManagement: true }],
  })
)

export type AdminConfig = Schema.Schema.Type<typeof AdminConfigSchema>
