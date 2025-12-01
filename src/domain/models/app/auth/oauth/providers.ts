/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { EnvRefSchema } from '../config'

// Re-export for backwards compatibility
export { EnvRefSchema, type EnvRef } from '../config'

/**
 * OAuth Provider Schema
 *
 * Essential OAuth providers for v1.
 * Focused on enterprise and developer use cases.
 *
 * Providers:
 * - google: Google Workspace integration
 * - github: Developer authentication
 * - microsoft: Enterprise/Azure AD
 * - slack: Workspace communication
 * - gitlab: Developer/CI-CD integration
 *
 * @example
 * ```typescript
 * const providers = ['google', 'github', 'slack']
 * ```
 */
export const OAuthProviderSchema = Schema.Literal(
  'google',
  'github',
  'microsoft',
  'slack',
  'gitlab'
).pipe(
  Schema.annotations({
    title: 'OAuth Provider',
    description: 'Supported OAuth providers for social login',
  })
)

export type OAuthProvider = Schema.Schema.Type<typeof OAuthProviderSchema>

/**
 * OAuth Provider Configuration Schema (Detailed)
 *
 * Detailed configuration for an OAuth provider with explicit env var references.
 *
 * @example
 * ```typescript
 * {
 *   provider: 'google',
 *   clientId: '$GOOGLE_CLIENT_ID',
 *   clientSecret: '$GOOGLE_CLIENT_SECRET',
 *   scopes: ['openid', 'profile', 'email']
 * }
 * ```
 */
export const OAuthProviderConfigSchema = Schema.Struct({
  provider: OAuthProviderSchema,
  clientId: EnvRefSchema,
  clientSecret: EnvRefSchema,
  scopes: Schema.optional(Schema.Array(Schema.String)),
  redirectUri: Schema.optional(Schema.String),
}).pipe(
  Schema.annotations({
    title: 'OAuth Provider Configuration',
    description: 'Detailed OAuth provider configuration with env var references',
  })
)

export type OAuthProviderConfig = Schema.Schema.Type<typeof OAuthProviderConfigSchema>

/**
 * Simple OAuth Configuration Schema
 *
 * Simple provider list using default environment variable names.
 * For provider 'google', expects:
 * - GOOGLE_CLIENT_ID
 * - GOOGLE_CLIENT_SECRET
 *
 * @example
 * ```typescript
 * { providers: ['google', 'github'] }
 * ```
 */
export const SimpleOAuthConfigSchema = Schema.Struct({
  providers: Schema.NonEmptyArray(OAuthProviderSchema),
}).pipe(
  Schema.annotations({
    title: 'Simple OAuth Configuration',
    description: 'OAuth with providers using default env var names',
  })
)

/**
 * Detailed OAuth Configuration Schema
 *
 * Explicit configuration for each provider with custom env var references.
 *
 * @example
 * ```typescript
 * {
 *   providers: [
 *     { provider: 'google', clientId: '$MY_GOOGLE_ID', clientSecret: '$MY_GOOGLE_SECRET' },
 *     { provider: 'github', clientId: '$GH_ID', clientSecret: '$GH_SECRET' }
 *   ]
 * }
 * ```
 */
export const DetailedOAuthConfigSchema = Schema.Struct({
  providers: Schema.NonEmptyArray(OAuthProviderConfigSchema),
}).pipe(
  Schema.annotations({
    title: 'Detailed OAuth Configuration',
    description: 'OAuth with explicit env var references per provider',
  })
)

/**
 * OAuth Configuration Schema
 *
 * Union of simple and detailed OAuth configurations.
 * Allows either:
 * - Simple: { providers: ['google', 'github'] }
 * - Detailed: { providers: [{ provider: 'google', clientId: '$MY_ID', ... }] }
 *
 * @example
 * ```typescript
 * // Simple (uses default env vars)
 * { providers: ['google', 'github'] }
 *
 * // Detailed (custom env vars)
 * {
 *   providers: [
 *     { provider: 'google', clientId: '$CUSTOM_ID', clientSecret: '$CUSTOM_SECRET' }
 *   ]
 * }
 * ```
 */
export const OAuthConfigSchema = Schema.Union(
  SimpleOAuthConfigSchema,
  DetailedOAuthConfigSchema
).pipe(
  Schema.annotations({
    title: 'OAuth Configuration',
    description: 'OAuth social login configuration',
    examples: [
      { providers: ['google', 'github'] },
      {
        providers: [
          {
            provider: 'google',
            clientId: '$GOOGLE_CLIENT_ID',
            clientSecret: '$GOOGLE_CLIENT_SECRET',
          },
        ],
      },
    ],
  })
)

export type OAuthConfig = Schema.Schema.Type<typeof OAuthConfigSchema>

/**
 * Get default environment variable names for a provider
 *
 * @param provider - OAuth provider name
 * @returns Object with clientId and clientSecret env var names
 */
export const getDefaultEnvVars = (
  provider: OAuthProvider
): { readonly clientId: string; readonly clientSecret: string } => {
  const upper = provider.toUpperCase()
  return {
    clientId: `${upper}_CLIENT_ID`,
    clientSecret: `${upper}_CLIENT_SECRET`,
  }
}
