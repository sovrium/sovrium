/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Custom Permission Schema
 *
 * Custom RLS condition with PostgreSQL expression.
 * Use when built-in permission types don't fit your needs.
 *
 * @example Custom condition with user variable
 * ```typescript
 * { type: 'custom', condition: '{userId} = owner_id' }
 * ```
 *
 * @example Custom condition with organization
 * ```typescript
 * { type: 'custom', condition: '{organizationId} = org_id AND status = \'active\'' }
 * ```
 */
export const CustomPermissionSchema = Schema.Struct({
  type: Schema.Literal('custom'),

  /**
   * PostgreSQL RLS condition expression.
   *
   * Supports variable substitution:
   * - `{userId}`: Current authenticated user's ID
   * - `{organizationId}`: Current user's organization ID
   * - `{roles}`: Array of user's roles
   */
  condition: Schema.String,
}).pipe(
  Schema.annotations({
    title: 'Custom Permission',
    description: 'Custom RLS condition with PostgreSQL expression.',
    examples: [
      { type: 'custom' as const, condition: '{userId} = owner_id' },
      { type: 'custom' as const, condition: '{organizationId} = organization_id' },
    ],
  })
)

export type CustomPermission = Schema.Schema.Type<typeof CustomPermissionSchema>
