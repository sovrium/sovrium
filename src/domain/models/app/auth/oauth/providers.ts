/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

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
 * Credentials are loaded from environment variables:
 * - {PROVIDER}_CLIENT_ID (e.g., GOOGLE_CLIENT_ID)
 * - {PROVIDER}_CLIENT_SECRET (e.g., GOOGLE_CLIENT_SECRET)
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
 * OAuth Configuration Schema
 *
 * Simple provider list using environment variables for credentials.
 * For each provider enabled, the system expects:
 * - {PROVIDER}_CLIENT_ID environment variable
 * - {PROVIDER}_CLIENT_SECRET environment variable
 *
 * @example
 * ```typescript
 * // Enable Google and GitHub OAuth
 * { providers: ['google', 'github'] }
 *
 * // Required environment variables:
 * // GOOGLE_CLIENT_ID=your-google-client-id
 * // GOOGLE_CLIENT_SECRET=your-google-client-secret
 * // GITHUB_CLIENT_ID=your-github-client-id
 * // GITHUB_CLIENT_SECRET=your-github-client-secret
 * ```
 */
export const OAuthConfigSchema = Schema.Struct({
  /** List of OAuth providers to enable */
  providers: Schema.NonEmptyArray(OAuthProviderSchema),
}).pipe(
  Schema.annotations({
    title: 'OAuth Configuration',
    description:
      'OAuth social login configuration. Credentials loaded from environment variables ({PROVIDER}_CLIENT_ID, {PROVIDER}_CLIENT_SECRET).',
    examples: [
      { providers: ['google'] },
      { providers: ['google', 'github'] },
      { providers: ['google', 'github', 'microsoft'] },
    ],
  })
)

export type OAuthConfig = Schema.Schema.Type<typeof OAuthConfigSchema>

/**
 * Get environment variable names for a provider
 *
 * @param provider - OAuth provider name
 * @returns Object with clientId and clientSecret env var names
 *
 * @example
 * ```typescript
 * getProviderEnvVars('google')
 * // Returns: { clientId: 'GOOGLE_CLIENT_ID', clientSecret: 'GOOGLE_CLIENT_SECRET' }
 * ```
 */
export const getProviderEnvVars = (
  provider: OAuthProvider
): { readonly clientId: string; readonly clientSecret: string } => {
  const upper = provider.toUpperCase()
  return {
    clientId: `${upper}_CLIENT_ID`,
    clientSecret: `${upper}_CLIENT_SECRET`,
  }
}
