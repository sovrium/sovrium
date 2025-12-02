/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Email and Password Authentication Method
 *
 * Traditional credential-based authentication using email and password.
 * This is the most common authentication method.
 *
 * Configuration options:
 * - requireEmailVerification: Require email verification before allowing sign-in
 * - minPasswordLength: Minimum password length (default: 8, range: 6-128)
 * - maxPasswordLength: Maximum password length (default: 128)
 *
 * @example
 * ```typescript
 * // Simple enable
 * { authentication: ['email-and-password'] }
 *
 * // With configuration
 * {
 *   authentication: [{
 *     method: 'email-and-password',
 *     requireEmailVerification: true,
 *     minPasswordLength: 12
 *   }]
 * }
 * ```
 */

/**
 * Email and Password configuration options
 */
export const EmailAndPasswordConfigSchema = Schema.Struct({
  method: Schema.Literal('email-and-password'),
  requireEmailVerification: Schema.optional(Schema.Boolean),
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
}).pipe(
  Schema.annotations({
    title: 'Email and Password Configuration',
    description: 'Configuration for email and password authentication',
  })
)

/**
 * Email and Password method - can be literal or config object
 */
export const EmailAndPasswordMethodSchema = Schema.Union(
  Schema.Literal('email-and-password'),
  EmailAndPasswordConfigSchema
).pipe(
  Schema.annotations({
    title: 'Email and Password Method',
    description: 'Email and password authentication method',
  })
)

export type EmailAndPasswordConfig = Schema.Schema.Type<typeof EmailAndPasswordConfigSchema>
export type EmailAndPasswordMethod = Schema.Schema.Type<typeof EmailAndPasswordMethodSchema>
