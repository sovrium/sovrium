/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Owner Permission Schema
 *
 * Restricts access to the record owner (user who created or owns the record).
 * Generates RLS policy: `USING ({field} = auth.current_user_id())`
 *
 * @example
 * ```typescript
 * update: { type: 'owner', field: 'owner_id' }
 * delete: { type: 'owner', field: 'created_by' }
 * ```
 */
export const OwnerPermissionSchema = Schema.Struct({
  type: Schema.Literal('owner'),
  /**
   * The field that stores the owner's user ID.
   * Common values: 'owner_id', 'user_id', 'created_by'
   */
  field: Schema.String.pipe(
    Schema.annotations({
      description: 'Field that stores the owner user ID (e.g., owner_id, user_id, created_by)',
      examples: ['owner_id', 'user_id', 'created_by'],
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'Owner Permission',
    description:
      'Only the record owner can access. Generates RLS policy comparing field to current user ID.',
    examples: [
      { type: 'owner' as const, field: 'owner_id' },
      { type: 'owner' as const, field: 'user_id' },
      { type: 'owner' as const, field: 'created_by' },
    ],
  })
)

export type OwnerPermission = Schema.Schema.Type<typeof OwnerPermissionSchema>
