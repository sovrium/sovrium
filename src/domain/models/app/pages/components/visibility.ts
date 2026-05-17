/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Visibility Schema
 *
 * Controls conditional visibility of components based on authentication state,
 * user roles, or field-based conditions. Components with visibility constraints
 * may be SSR-excluded (condition) or CSS-hidden (when/roles) when conditions
 * are not met.
 *
 * - `when`: Show only for authenticated or unauthenticated users
 * - `roles`: Show only for users with specific roles
 * - `condition`: Show based on a field value comparison (e.g., user plan or role)
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
 *
 * # Show only to premium users (SSR-excluded when condition doesn't match)
 * visibility:
 *   condition:
 *     field: $user.plan
 *     operator: eq
 *     value: premium
 *
 * # Show to non-premium users
 * visibility:
 *   condition:
 *     field: $user.plan
 *     operator: neq
 *     value: premium
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
  /** Field-based condition (SSR-excluded when condition doesn't match) */
  condition: Schema.optional(
    Schema.Struct({
      /** Field reference (e.g., $user.plan, $user.role) */
      field: Schema.String.annotations({
        description: 'Field reference to evaluate (e.g., $user.plan)',
      }),
      /** Comparison operator */
      operator: Schema.Literal('eq', 'neq').annotations({
        description: 'Comparison operator: eq (equals) or neq (not equals)',
      }),
      /** Value to compare against */
      value: Schema.String.annotations({
        description: 'Value to compare the field against',
      }),
    }).annotations({
      title: 'Visibility Condition',
      description: 'Field-based condition for SSR-excluded visibility',
    })
  ),
}).annotations({
  title: 'Visibility',
  description: 'Conditional component visibility based on authentication state and user roles',
})

/** @public */
export type Visibility = Schema.Schema.Type<typeof VisibilitySchema>
