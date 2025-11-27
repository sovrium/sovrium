/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Public Permission Schema
 *
 * Allows unrestricted access - no RLS policy is generated.
 * Use for publicly accessible data like published articles.
 *
 * @example
 * ```typescript
 * read: { type: 'public' }
 * ```
 */
export const PublicPermissionSchema = Schema.Struct({
  type: Schema.Literal('public'),
}).pipe(
  Schema.annotations({
    title: 'Public Permission',
    description: 'Unrestricted access - no RLS policy. Anyone can access.',
    examples: [{ type: 'public' as const }],
  })
)

export type PublicPermission = Schema.Schema.Type<typeof PublicPermissionSchema>
