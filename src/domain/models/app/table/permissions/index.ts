/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TableFieldPermissionsSchema } from './field-permission'
import { TablePermissionSchema } from './permission'

/**
 * Table Permissions Schema
 *
 * Permissions for table operations using a simplified 3-format system.
 * Each operation accepts one of:
 * - `'all'` — Everyone (including unauthenticated users)
 * - `'authenticated'` — Any logged-in user
 * - `['admin', 'editor']` — Specific role names (array)
 *
 * Operations:
 * - `read` — Who can view records
 * - `comment` — Who can add comments to records
 * - `create` — Who can create new records
 * - `update` — Who can modify existing records
 * - `delete` — Who can remove records
 *
 * Omitted operations default to deny (no access).
 *
 * @example Role-based permissions
 * ```yaml
 * permissions:
 *   read: all
 *   comment: authenticated
 *   create: ['admin', 'editor']
 *   update: ['admin', 'editor']
 *   delete: ['admin']
 * ```
 *
 * @example Minimal read-only public table
 * ```yaml
 * permissions:
 *   read: all
 * ```
 */
export const TablePermissionsSchema = Schema.Struct({
  /**
   * READ permission — who can view records from this table.
   */
  read: Schema.optional(TablePermissionSchema),

  /**
   * COMMENT permission — who can add comments to records.
   */
  comment: Schema.optional(TablePermissionSchema),

  /**
   * CREATE permission — who can create new records in this table.
   */
  create: Schema.optional(TablePermissionSchema),

  /**
   * UPDATE permission — who can modify existing records in this table.
   */
  update: Schema.optional(TablePermissionSchema),

  /**
   * DELETE permission — who can remove records from this table.
   */
  delete: Schema.optional(TablePermissionSchema),

  /**
   * Field-level permissions for granular column access control.
   *
   * Allows restricting read/write access to specific fields based on roles.
   * Uses the same 3-format permission system as table-level operations.
   *
   * @example Restrict salary field to admins
   * ```yaml
   * fields:
   *   - field: salary
   *     read: ['admin', 'hr']
   *     write: ['admin']
   * ```
   */
  fields: Schema.optional(TableFieldPermissionsSchema),
}).pipe(
  Schema.annotations({
    title: 'Table Permissions',
    description:
      "Permissions for table operations. Each operation accepts 'all', 'authenticated', or a role array. Omitted operations default to deny.",
    examples: [
      // Public read, admin-only write
      {
        read: 'all' as const,
        comment: 'authenticated' as const,
        create: ['admin'] as readonly string[],
        update: ['admin'] as readonly string[],
        delete: ['admin'] as readonly string[],
      },
      // Role-based with field restrictions
      {
        read: 'all' as const,
        create: ['admin', 'editor'] as readonly string[],
        update: ['admin', 'editor'] as readonly string[],
        delete: ['admin'] as readonly string[],
      },
    ],
  })
)

export type TablePermissions = Schema.Schema.Type<typeof TablePermissionsSchema>

// Re-export sub-schemas for external use
export * from './permission'
export * from './field-permission'
export * from './permission-evaluator'
