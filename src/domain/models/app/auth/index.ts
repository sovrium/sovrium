/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { EmailAndPasswordProviderSchema } from './email-and-password'
import { AuthPluginsSchema } from './plugins'

/**
 * Authentication configuration
 *
 * Defines authentication settings for the application including:
 * - Enable/disable authentication globally
 * - Email and password authentication provider
 * - Optional plugins (admin, organization)
 *
 * @example
 * ```typescript
 * const authConfig = {
 *   enabled: true,
 *   emailAndPassword: { enabled: true },
 *   plugins: {
 *     admin: { enabled: true },
 *     organization: { enabled: true },
 *   },
 * }
 * ```
 */
export const AuthSchema = Schema.Struct({
  /**
   * Whether authentication is enabled globally
   *
   * When disabled, all authentication features are turned off.
   */
  enabled: Schema.Boolean,

  /**
   * Email and password authentication provider (optional)
   *
   * Traditional authentication using email address and password.
   * Includes registration, sign-in, password reset, and email verification.
   */
  emailAndPassword: Schema.optional(EmailAndPasswordProviderSchema),

  /**
   * Authentication plugins (optional)
   *
   * Optional features that extend authentication functionality:
   * - admin: User management, banning, administrative features
   * - organization: Multi-tenancy, organization management
   */
  plugins: Schema.optional(AuthPluginsSchema),
}).pipe(
  Schema.annotations({
    title: 'Authentication Configuration',
    description: 'Complete authentication configuration including providers and optional plugins',
    examples: [
      {
        enabled: true,
        emailAndPassword: { enabled: true },
        plugins: {
          admin: { enabled: true },
          organization: { enabled: true },
        },
      },
      {
        enabled: true,
        emailAndPassword: { enabled: true },
      },
      {
        enabled: false,
      },
    ],
  })
)

/**
 * TypeScript type inferred from AuthSchema
 *
 * Use this type for type-safe access to validated authentication configuration.
 *
 * @example
 * ```typescript
 * const auth: Auth = {
 *   enabled: true,
 *   emailAndPassword: { enabled: true },
 * }
 * ```
 */
export type Auth = Schema.Schema.Type<typeof AuthSchema>

/**
 * Encoded type of AuthSchema (what goes in)
 *
 * In this case, it's the same as Auth since we don't use transformations.
 */
export type AuthEncoded = Schema.Schema.Encoded<typeof AuthSchema>

// Re-export all auth-related schemas and types for convenient imports
export * from './email-and-password'
export * from './plugins'
