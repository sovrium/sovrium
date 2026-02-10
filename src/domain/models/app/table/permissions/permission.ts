/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Table Permission Schema
 *
 * Simplified permission value for a single CRUD operation.
 * Accepts one of 3 formats:
 *
 * - `'all'` — Everyone (including unauthenticated users)
 * - `'authenticated'` — Any logged-in user
 * - `['admin', 'editor']` — Specific role names (array)
 *
 * @example
 * ```yaml
 * permissions:
 *   read: all
 *   comment: authenticated
 *   create: ['admin', 'editor']
 *   update: ['admin', 'editor']
 *   delete: ['admin']
 * ```
 */
export const TablePermissionSchema = Schema.Union(
  Schema.Literal('all'),
  Schema.Literal('authenticated'),
  Schema.Array(Schema.String).pipe(
    Schema.minItems(1),
    Schema.annotations({
      description: 'Array of role names that have access (e.g., admin, editor). At least one role.',
      examples: [['admin'], ['admin', 'editor'], ['admin', 'member', 'viewer']],
    })
  )
).pipe(
  Schema.annotations({
    title: 'Table Permission',
    description:
      "Permission value for a single operation. 'all' (everyone), 'authenticated' (logged-in users), or role array ['admin', 'editor'].",
    examples: ['all', 'authenticated', ['admin'], ['admin', 'editor']],
  })
)

export type TablePermission = Schema.Schema.Type<typeof TablePermissionSchema>
