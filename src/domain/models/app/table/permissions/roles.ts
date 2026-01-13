/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Roles Permission Schema
 *
 * Restricts access to users with specific roles.
 * Generates RLS policy: `USING (auth.user_has_role('role1') OR auth.user_has_role('role2'))`
 *
 * Empty roles array means deny all access (no one is allowed).
 *
 * @example
 * ```typescript
 * create: { type: 'roles', roles: ['admin', 'editor'] }
 * // Deny all access:
 * delete: { type: 'roles', roles: [] }
 * ```
 */
export const RolesPermissionSchema = Schema.Struct({
  type: Schema.Literal('roles'),
  /**
   * List of roles that have access.
   * Multiple roles are OR'd together in the generated policy.
   * Empty array means deny all access (no one is allowed).
   */
  roles: Schema.Array(Schema.String).pipe(
    Schema.annotations({
      description:
        'List of roles that have access (e.g., admin, member, editor). Empty array denies all access.',
      examples: [['admin'], ['admin', 'member'], ['owner', 'admin', 'editor'], []],
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'Roles Permission',
    description:
      'Only users with specified roles can access. Generates RLS policy with auth.user_has_role(). Empty roles array denies all access.',
    examples: [
      { type: 'roles' as const, roles: ['admin'] },
      { type: 'roles' as const, roles: ['admin', 'member'] },
      { type: 'roles' as const, roles: [] },
    ],
  })
)

export type RolesPermission = Schema.Schema.Type<typeof RolesPermissionSchema>
