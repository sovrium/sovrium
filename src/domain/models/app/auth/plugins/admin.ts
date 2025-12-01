/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { DefaultAdminSchema } from '../config'

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
 * - defaultAdmin: Create a default admin user on first startup
 *
 * @example
 * ```typescript
 * // Simple enable
 * { plugins: { admin: true } }
 *
 * // With configuration
 * { plugins: { admin: { impersonation: true, userManagement: true } } }
 *
 * // With default admin user
 * {
 *   plugins: {
 *     admin: {
 *       defaultAdmin: {
 *         email: 'admin@myapp.com',
 *         password: '$ADMIN_PASSWORD',
 *         name: 'Admin User'
 *       }
 *     }
 *   }
 * }
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
    defaultAdmin: Schema.optional(
      DefaultAdminSchema.pipe(
        Schema.annotations({ description: 'Default admin user created on first startup' })
      )
    ),
  })
).pipe(
  Schema.annotations({
    title: 'Admin Plugin Configuration',
    description: 'Administrative features for user management',
    examples: [
      true,
      { impersonation: true, userManagement: true },
      {
        impersonation: true,
        defaultAdmin: { email: 'admin@myapp.com', password: '$ADMIN_PASSWORD' },
      },
    ],
  })
)

export type AdminConfig = Schema.Schema.Type<typeof AdminConfigSchema>
