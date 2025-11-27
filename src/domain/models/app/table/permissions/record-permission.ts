/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Record Permission Schema
 *
 * Defines row-level security (RLS) conditions for record access.
 * Uses PostgreSQL RLS policy syntax with variable substitution.
 *
 * Variables available:
 * - `{userId}`: Current authenticated user's ID
 * - `{organizationId}`: Current user's organization ID
 * - `{roles}`: Array of user's roles
 *
 * @example User can only read their own records
 * ```typescript
 * {
 *   action: 'read',
 *   condition: '{userId} = created_by',
 * }
 * ```
 *
 * @example User can only update records they own
 * ```typescript
 * {
 *   action: 'update',
 *   condition: '{userId} = owner_id',
 * }
 * ```
 *
 * @example Organization-scoped access
 * ```typescript
 * {
 *   action: 'read',
 *   condition: '{organizationId} = organization_id',
 * }
 * ```
 */
export const RecordPermissionSchema = Schema.Struct({
  /**
   * The CRUD action this permission applies to.
   */
  action: Schema.Literal('read', 'create', 'update', 'delete'),

  /**
   * PostgreSQL RLS condition expression.
   * Supports variable substitution with {userId}, {organizationId}, {roles}.
   */
  condition: Schema.String,
}).pipe(
  Schema.annotations({
    title: 'Record Permission',
    description: 'Row-level security condition for record access.',
    examples: [
      {
        action: 'read' as const,
        condition: '{userId} = created_by',
      },
      {
        action: 'update' as const,
        condition: '{userId} = owner_id',
      },
      {
        action: 'read' as const,
        condition: '{organizationId} = organization_id',
      },
    ],
  })
)

export type RecordPermission = Schema.Schema.Type<typeof RecordPermissionSchema>

/**
 * Record Permissions Array Schema
 *
 * Array of record-level permission configurations (RLS policies).
 */
export const RecordPermissionsSchema = Schema.Array(RecordPermissionSchema).pipe(
  Schema.annotations({
    title: 'Record Permissions',
    description: 'Array of row-level security conditions.',
  })
)

export type RecordPermissions = Schema.Schema.Type<typeof RecordPermissionsSchema>
