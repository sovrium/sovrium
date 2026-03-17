/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Visibility Schema
 *
 * Controls conditional visibility of components based on authentication state
 * and user roles. Components with visibility constraints are rendered server-side
 * but only displayed when conditions are met.
 *
 * - `when`: Show only for authenticated or unauthenticated users
 * - `roles`: Show only for users with specific roles
 *
 * When both `when` and `roles` are specified, both conditions must be met
 * (AND logic).
 *
 * @example
 * ```yaml
 * # Show only to logged-in users
 * visibility:
 *   when: authenticated
 *
 * # Show only to guests (e.g., login CTA)
 * visibility:
 *   when: unauthenticated
 *
 * # Show only to admins
 * visibility:
 *   when: authenticated
 *   roles: ['admin']
 *
 * # Show to admins and editors
 * visibility:
 *   roles: ['admin', 'editor']
 * ```
 */
export const VisibilitySchema = Schema.Struct({
  /** Authentication state condition */
  when: Schema.optional(
    Schema.Literal('authenticated', 'unauthenticated').annotations({
      description: "Show component only when user is 'authenticated' or 'unauthenticated'",
    })
  ),
  /** Role-based visibility filter */
  roles: Schema.optional(
    Schema.Array(Schema.String).pipe(
      Schema.minItems(1),
      Schema.annotations({
        title: 'Visibility Roles',
        description: 'Show component only to users with one of these roles',
        examples: [['admin'], ['admin', 'editor']],
      })
    )
  ),
}).annotations({
  title: 'Visibility',
  description: 'Conditional component visibility based on authentication state and user roles',
})

export type Visibility = Schema.Schema.Type<typeof VisibilitySchema>
