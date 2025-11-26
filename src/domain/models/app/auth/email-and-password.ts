/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Email and password authentication provider configuration
 *
 * Enables traditional email/password authentication with:
 * - User registration with email and password
 * - Password-based sign-in
 * - Password reset and change functionality
 * - Email verification
 *
 * @example
 * ```typescript
 * const emailPasswordConfig = {
 *   enabled: true,
 * }
 * ```
 */
export const EmailAndPasswordProviderSchema = Schema.Struct({
  /**
   * Whether email and password authentication is enabled
   */
  enabled: Schema.Boolean,
}).pipe(
  Schema.annotations({
    title: 'Email and Password Provider',
    description: 'Configuration for email and password authentication',
    examples: [{ enabled: true }, { enabled: false }],
  })
)

/**
 * TypeScript type inferred from EmailAndPasswordProviderSchema
 */
export type EmailAndPasswordProvider = Schema.Schema.Type<typeof EmailAndPasswordProviderSchema>

/**
 * Encoded type of EmailAndPasswordProviderSchema (what goes in)
 */
export type EmailAndPasswordProviderEncoded = Schema.Schema.Encoded<
  typeof EmailAndPasswordProviderSchema
>
