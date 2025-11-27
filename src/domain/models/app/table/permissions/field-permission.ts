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
 *
 * @example Restrict salary field to admins only
 * ```typescript
 * {
 *   field: 'salary',
 *   read: { type: 'roles', roles: ['admin'] },
 *   write: { type: 'roles', roles: ['admin'] },
 * }
 * ```
 *
 * @example Make email readable by all authenticated users, writable by owner
 * ```typescript
 * {
 *   field: 'email',
 *   read: { type: 'authenticated' },
 *   write: { type: 'owner', field: 'user_id' },
 * }
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
    description: 'Granular permission configuration for a specific field.',
    examples: [
      {
        field: 'salary',
        read: { type: 'roles' as const, roles: ['admin'] },
      },
      {
        field: 'email',
        read: { type: 'authenticated' as const },
        write: { type: 'owner' as const, field: 'user_id' },
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
