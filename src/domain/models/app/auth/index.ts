/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { AuthenticationMethodSchema } from './email-and-password'
import { AuthFeatureSchema } from './features'

/**
 * Authentication configuration
 *
 * Defines authentication settings for the application.
 * If this config exists, authentication is enabled.
 * If omitted from the app config, no auth endpoints are available.
 *
 * - authentication: Array of enabled authentication methods
 * - features: Array of enabled features (optional)
 *
 * @example
 * ```typescript
 * // Full configuration with all features
 * const authConfig = {
 *   authentication: ['email-and-password'],
 *   features: ['admin', 'organization'],
 * }
 *
 * // Minimal configuration (email-and-password only)
 * const minimalAuth = {
 *   authentication: ['email-and-password'],
 * }
 * ```
 */
export const AuthSchema = Schema.Struct({
  /**
   * Authentication methods to enable
   *
   * At least one authentication method must be specified.
   * Currently supported: 'email-and-password'
   */
  authentication: Schema.NonEmptyArray(AuthenticationMethodSchema),

  /**
   * Authentication features to enable (optional)
   *
   * Available features:
   * - 'admin': User management, banning, administrative features
   * - 'organization': Multi-tenancy, organization management
   */
  features: Schema.optional(Schema.Array(AuthFeatureSchema)),
}).pipe(
  Schema.annotations({
    title: 'Authentication Configuration',
    description:
      'Authentication configuration. If present, auth is enabled with specified methods and features.',
    examples: [
      {
        authentication: ['email-and-password'],
        features: ['admin', 'organization'],
      },
      {
        authentication: ['email-and-password'],
        features: ['admin'],
      },
      {
        authentication: ['email-and-password'],
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
 *   authentication: ['email-and-password'],
 *   features: ['admin', 'organization'],
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
export * from './features'
