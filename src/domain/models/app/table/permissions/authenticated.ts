/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Authenticated Permission Schema
 *
 * Restricts access to authenticated users only.
 * Generates RLS policy: `USING (auth.is_authenticated())`
 *
 * @example
 * ```typescript
 * update: { type: 'authenticated' }
 * ```
 */
export const AuthenticatedPermissionSchema = Schema.Struct({
  type: Schema.Literal('authenticated'),
}).pipe(
  Schema.annotations({
    title: 'Authenticated Permission',
    description:
      'Only authenticated users can access. Generates RLS policy with auth.is_authenticated().',
    examples: [{ type: 'authenticated' as const }],
  })
)

export type AuthenticatedPermission = Schema.Schema.Type<typeof AuthenticatedPermissionSchema>
