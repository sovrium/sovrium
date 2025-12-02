/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Email and Password Authentication Method Configuration
 *
 * Traditional credential-based authentication using email and password.
 * This is the most common authentication method.
 *
 * Can be:
 * - A boolean (true to enable with defaults)
 * - A configuration object for customization
 *
 * Configuration options:
 * - requireEmailVerification: Require email verification before allowing sign-in
 * - minPasswordLength: Minimum password length (default: 8, range: 6-128)
 * - maxPasswordLength: Maximum password length (default: 128)
 *
 * @example
 * ```typescript
 * // Simple enable
 * { methods: { emailAndPassword: true } }
 *
 * // With configuration
 * {
 *   methods: {
 *     emailAndPassword: {
 *       requireEmailVerification: true,
 *       minPasswordLength: 12
 *     }
 *   }
 * }
 * ```
 */
export const EmailAndPasswordConfigSchema = Schema.Union(
  Schema.Boolean,
  Schema.Struct({
    requireEmailVerification: Schema.optional(
      Schema.Boolean.pipe(
        Schema.annotations({ description: 'Require email verification before sign-in' })
      )
    ),
    minPasswordLength: Schema.optional(
      Schema.Number.pipe(
        Schema.between(6, 128),
        Schema.annotations({ description: 'Minimum password length (6-128)' })
      )
    ),
    maxPasswordLength: Schema.optional(
      Schema.Number.pipe(
        Schema.between(8, 256),
        Schema.annotations({ description: 'Maximum password length (8-256)' })
      )
    ),
  })
).pipe(
  Schema.annotations({
    title: 'Email and Password Configuration',
    description: 'Configuration for email and password authentication',
    examples: [true, { requireEmailVerification: true }, { minPasswordLength: 12 }],
  })
)

export type EmailAndPasswordConfig = Schema.Schema.Type<typeof EmailAndPasswordConfigSchema>
