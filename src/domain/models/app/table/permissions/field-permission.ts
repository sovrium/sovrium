/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TablePermissionSchema } from './permission'

/**
 * Field Permission Schema
 *
 * Defines granular permissions for a specific field within a table.
 * Allows restricting read/write access to individual columns based on roles.
 * Uses the same 3-format permission system as table-level operations.
 *
 * @example Restrict salary field to admins only
 * ```yaml
 * - field: salary
 *   read: ['admin', 'hr']
 *   write: ['admin']
 * ```
 *
 * @example Make department readable by all, writable by admins
 * ```yaml
 * - field: department
 *   read: all
 *   write: ['admin']
 * ```
 */
export const FieldPermissionSchema = Schema.Struct({
  /**
   * The name of the field this permission applies to.
   */
  field: Schema.String,

  /**
   * Who can read (SELECT) this field.
   * If not specified, inherits from table-level read permission.
   */
  read: Schema.optional(TablePermissionSchema),

  /**
   * Who can write (INSERT/UPDATE) this field.
   * If not specified, inherits from table-level create/update permission.
   */
  write: Schema.optional(TablePermissionSchema),
}).pipe(
  Schema.annotations({
    title: 'Field Permission',
    description:
      "Granular permission for a specific field. Uses same format as table-level: 'all', 'authenticated', or role array.",
    examples: [
      {
        field: 'salary',
        read: ['admin', 'hr'] as readonly string[],
        write: ['admin'] as readonly string[],
      },
      {
        field: 'department',
        read: 'all' as const,
        write: ['admin'] as readonly string[],
      },
    ],
  })
)

export type FieldPermission = Schema.Schema.Type<typeof FieldPermissionSchema>

/**
 * Table Field Permissions Array Schema
 *
 * Array of field-level permission configurations for table permissions.
 */
export const TableFieldPermissionsSchema = Schema.Array(FieldPermissionSchema).pipe(
  Schema.annotations({
    title: 'Table Field Permissions',
    description: 'Array of field-level permission configurations for table permissions.',
  })
)

export type TableFieldPermissions = Schema.Schema.Type<typeof TableFieldPermissionsSchema>
