/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const VisibilitySchema = Schema.Struct({
  when: Schema.optional(
    Schema.Literal('authenticated', 'unauthenticated').annotations({
      description: "Show component only when user is 'authenticated' or 'unauthenticated'",
    })
  ),
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
  condition: Schema.optional(
    Schema.Struct({
      field: Schema.String.annotations({
        description: 'Field reference to evaluate (e.g., $user.plan)',
      }),
      operator: Schema.Literal('eq', 'neq').annotations({
        description: 'Comparison operator: eq (equals) or neq (not equals)',
      }),
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

export type Visibility = Schema.Schema.Type<typeof VisibilitySchema>
