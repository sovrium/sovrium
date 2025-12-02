/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { AuthEmailTemplatesSchema } from './config'
import { hasAnyMethodEnabled, isMethodEnabled, MethodsConfigSchema } from './methods'
import { OAuthConfigSchema } from './oauth'
import { PluginsConfigSchema } from './plugins'
import { validateAuthConfig } from './validation'

// Re-export all auth-related schemas and types for convenient imports
export * from './config'
export * from './methods'
export * from './oauth'
export * from './plugins'
export * from './validation'

/**
 * Authentication Configuration Schema
 *
 * Comprehensive authentication configuration supporting all Better Auth features.
 * If this config exists, authentication is enabled.
 * If omitted from the app config, no auth endpoints are available.
 *
 * Infrastructure configuration (secrets, URLs, credentials) is handled via
 * environment variables, not in this schema. See .env.example for details.
 *
 * Structure:
 * - methods: Object of enabled authentication methods (required, at least one)
 * - oauth: Social login configuration (optional)
 * - plugins: Feature plugins like 2FA, admin, organization (optional)
 *
 * Authentication Methods (v1):
 * - emailAndPassword: Traditional credential-based authentication
 * - magicLink: Passwordless email link authentication
 * - passkey: WebAuthn biometric/security key authentication
 *
 * OAuth Providers (v1):
 * - google, github, microsoft, slack, gitlab
 * - Credentials loaded from environment variables (e.g., GOOGLE_CLIENT_ID)
 *
 * Plugins (v1):
 * - admin: User management, banning, impersonation
 * - organization: Multi-tenancy, team management
 * - twoFactor: TOTP-based two-factor authentication
 * - apiKeys: Programmatic API access
 * - bearer/jwt: Token-based authentication
 *
 * Environment Variables (infrastructure config):
 * - BETTER_AUTH_SECRET: Secret key for signing tokens
 * - BETTER_AUTH_BASE_URL: Base URL for callbacks (optional)
 * - {PROVIDER}_CLIENT_ID: OAuth client ID per provider
 * - {PROVIDER}_CLIENT_SECRET: OAuth client secret per provider
 * - ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME: Default admin user (optional)
 *
 * @example
 * ```typescript
 * // Minimal configuration
 * { methods: { emailAndPassword: true } }
 *
 * // With email verification
 * {
 *   methods: {
 *     emailAndPassword: { requireEmailVerification: true }
 *   }
 * }
 *
 * // Social login
 * {
 *   methods: { emailAndPassword: true },
 *   oauth: { providers: ['google', 'github'] }
 * }
 *
 * // Enterprise setup
 * {
 *   methods: {
 *     emailAndPassword: { requireEmailVerification: true },
 *     passkey: { userVerification: 'required' }
 *   },
 *   oauth: { providers: ['microsoft', 'google'] },
 *   plugins: {
 *     admin: { impersonation: true },
 *     organization: { maxMembersPerOrg: 50 },
 *     twoFactor: { issuer: 'MyCompany', backupCodes: true }
 *   }
 * }
 * ```
 */
export const AuthSchema = Schema.Struct({
  /**
   * Authentication methods to enable
   *
   * Object containing enabled authentication methods.
   * Each method can be a boolean (true to enable) or a configuration object.
   * At least one method must be enabled.
   *
   * @example
   * ```typescript
   * // Simple methods
   * { emailAndPassword: true, magicLink: true }
   *
   * // With configuration
   * {
   *   emailAndPassword: { requireEmailVerification: true, minPasswordLength: 12 },
   *   passkey: { userVerification: 'required' }
   * }
   * ```
   */
  methods: MethodsConfigSchema,

  /**
   * OAuth social login configuration (optional)
   *
   * Enable social login with providers like Google, GitHub, etc.
   * Credentials are loaded from environment variables.
   *
   * @example
   * ```typescript
   * // Simple (uses default env vars)
   * { providers: ['google', 'github'] }
   *
   * // Explicit env references
   * {
   *   providers: [
   *     { provider: 'google', clientId: '$MY_GOOGLE_ID', clientSecret: '$MY_GOOGLE_SECRET' }
   *   ]
   * }
   * ```
   */
  oauth: Schema.optional(OAuthConfigSchema),

  /**
   * Authentication plugins configuration (optional)
   *
   * Enable additional features like 2FA, admin panel, organizations, etc.
   * Each plugin can be a boolean (true to enable) or a configuration object.
   *
   * @example
   * ```typescript
   * {
   *   admin: true,
   *   organization: { maxMembersPerOrg: 50 },
   *   twoFactor: { issuer: 'MyApp' }
   * }
   * ```
   */
  plugins: Schema.optional(PluginsConfigSchema),

  /**
   * Email templates for authentication flows (optional)
   *
   * Customize the subject and content of emails sent during authentication.
   * Templates support variable substitution using $variable syntax.
   * If not provided, Better Auth uses sensible defaults.
   *
   * @example
   * ```typescript
   * {
   *   verification: {
   *     subject: 'Verify your email for MyApp',
   *     text: 'Hi $name, click here to verify: $url'
   *   },
   *   resetPassword: {
   *     subject: 'Reset your password',
   *     text: 'Click the link to reset your password: $url'
   *   }
   * }
   * ```
   */
  emailTemplates: Schema.optional(AuthEmailTemplatesSchema),
}).pipe(
  // Cross-field validation - returns undefined for valid, string for error
  Schema.filter((config) => {
    // Check at least one method is enabled
    if (!hasAnyMethodEnabled(config.methods)) {
      return 'At least one authentication method must be enabled'
    }

    const result = validateAuthConfig(config)
    if (!result.success) {
      return result.message ?? 'Validation failed'
    }
    return undefined
  }),
  Schema.annotations({
    title: 'Authentication Configuration',
    description:
      'Authentication configuration with methods, OAuth, plugins, and email templates. Infrastructure config (secrets, URLs, credentials) is set via environment variables.',
    examples: [
      // Minimal
      { methods: { emailAndPassword: true } },
      // With email verification
      {
        methods: { emailAndPassword: { requireEmailVerification: true } },
      },
      // Social login with email templates
      {
        methods: { emailAndPassword: true },
        oauth: { providers: ['google', 'github'] },
        emailTemplates: {
          verification: { subject: 'Verify your email', text: 'Click to verify: $url' },
          resetPassword: { subject: 'Reset your password', text: 'Reset link: $url' },
        },
      },
      // Enterprise setup
      {
        methods: {
          emailAndPassword: { requireEmailVerification: true },
          passkey: { userVerification: 'required' },
        },
        oauth: { providers: ['microsoft', 'google'] },
        plugins: {
          admin: { impersonation: true },
          organization: { maxMembersPerOrg: 50 },
          twoFactor: { issuer: 'MyCompany', backupCodes: true },
        },
      },
    ],
  })
)

/**
 * TypeScript type inferred from AuthSchema
 *
 * Use this type for type-safe access to validated authentication configuration.
 */
export type Auth = Schema.Schema.Type<typeof AuthSchema>

/**
 * Encoded type of AuthSchema (what goes in before validation)
 */
export type AuthEncoded = Schema.Schema.Encoded<typeof AuthSchema>

/**
 * Helper to check if auth is configured with a specific method
 */
export const hasAuthenticationMethod = (auth: Auth, methodName: keyof Auth['methods']): boolean => {
  return isMethodEnabled(auth.methods, methodName)
}

/**
 * Helper to check if auth has a specific plugin enabled
 */
export const hasPlugin = (auth: Auth, pluginName: keyof NonNullable<Auth['plugins']>): boolean => {
  if (!auth.plugins) return false
  const plugin = auth.plugins[pluginName]
  if (typeof plugin === 'boolean') return plugin
  return plugin !== undefined
}
