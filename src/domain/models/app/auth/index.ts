/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { AuthEmailTemplatesSchema, EnvRefSchema } from './config'
import { AuthenticationMethodSchema } from './methods'
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
 * Structure:
 * - authentication: Array of enabled authentication methods (required)
 * - oauth: Social login configuration (optional)
 * - plugins: Feature plugins like 2FA, admin, organization (optional)
 *
 * Authentication Methods (v1):
 * - email-and-password: Traditional credential-based authentication
 * - magic-link: Passwordless email link authentication
 * - passkey: WebAuthn biometric/security key authentication
 *
 * OAuth Providers (v1):
 * - google, github, microsoft, slack, gitlab
 * - Supports custom scopes and env var references for credentials
 *
 * Plugins (v1):
 * - admin: User management, banning, impersonation
 * - organization: Multi-tenancy, team management
 * - twoFactor: TOTP-based two-factor authentication
 * - apiKeys: Programmatic API access
 * - bearer/jwt: Token-based authentication
 *
 * @example
 * ```typescript
 * // Minimal configuration
 * { authentication: ['email-and-password'] }
 *
 * // With secret and baseURL
 * {
 *   secret: '$BETTER_AUTH_SECRET',
 *   baseURL: 'https://myapp.com',
 *   authentication: ['email-and-password']
 * }
 *
 * // Social login
 * {
 *   authentication: ['email-and-password'],
 *   oauth: { providers: ['google', 'github'] }
 * }
 *
 * // Enterprise setup with emails
 * {
 *   secret: '$BETTER_AUTH_SECRET',
 *   baseURL: 'https://myapp.com',
 *   authentication: ['email-and-password', 'passkey'],
 *   oauth: { providers: ['microsoft', 'google'] },
 *   emails: {
 *     from: 'noreply@myapp.com',
 *     fromName: 'MyApp',
 *     provider: 'resend',
 *     apiKey: '$RESEND_API_KEY'
 *   },
 *   plugins: {
 *     admin: {
 *       impersonation: true,
 *       defaultAdmin: { email: 'admin@myapp.com', password: '$ADMIN_PASSWORD' }
 *     },
 *     organization: { maxMembersPerOrg: 50 },
 *     twoFactor: { issuer: 'MyCompany', backupCodes: true }
 *   }
 * }
 * ```
 */
export const AuthSchema = Schema.Struct({
  /**
   * Secret key for signing tokens and cookies (optional, env var reference)
   *
   * If not provided, uses BETTER_AUTH_SECRET environment variable.
   * Must be a strong, random string for production.
   *
   * @example '$BETTER_AUTH_SECRET' or '$MY_AUTH_SECRET'
   */
  secret: Schema.optional(
    EnvRefSchema.pipe(
      Schema.annotations({
        description: 'Secret key for signing (env var reference, defaults to $BETTER_AUTH_SECRET)',
      })
    )
  ),

  /**
   * Base URL for authentication endpoints (optional)
   *
   * Used for constructing callback URLs, magic links, etc.
   * If not provided, auto-detected from request.
   *
   * @example 'https://myapp.com' or 'http://localhost:3000'
   */
  baseURL: Schema.optional(
    Schema.String.pipe(
      Schema.pattern(/^https?:\/\/.+/),
      Schema.annotations({
        description: 'Base URL for auth endpoints (e.g., https://myapp.com)',
      })
    )
  ),

  /**
   * Authentication methods to enable
   *
   * At least one authentication method must be specified.
   * Each method can be a simple string or a configuration object.
   *
   * @example
   * ```typescript
   * // Simple methods
   * ['email-and-password', 'magic-link']
   *
   * // With configuration
   * [
   *   { method: 'email-and-password', minPasswordLength: 12 },
   *   'magic-link',
   *   { method: 'passkey', userVerification: 'required' }
   * ]
   * ```
   */
  authentication: Schema.NonEmptyArray(AuthenticationMethodSchema),

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
    const result = validateAuthConfig(config)
    if (!result.success) {
      return result.message ?? 'Validation failed'
    }
    return undefined
  }),
  Schema.annotations({
    title: 'Authentication Configuration',
    description:
      'Comprehensive authentication configuration with methods, OAuth, plugins, and email templates. Email transport configuration is handled at the app level.',
    examples: [
      // Minimal
      { authentication: ['email-and-password'] },
      // With secret and baseURL
      {
        secret: '$BETTER_AUTH_SECRET',
        baseURL: 'https://myapp.com',
        authentication: ['email-and-password'],
      },
      // Social login with email templates
      {
        authentication: ['email-and-password'],
        oauth: { providers: ['google', 'github'] },
        emailTemplates: {
          verification: { subject: 'Verify your email', text: 'Click to verify: $url' },
          resetPassword: { subject: 'Reset your password', text: 'Reset link: $url' },
        },
      },
      // Enterprise with default admin
      {
        secret: '$BETTER_AUTH_SECRET',
        baseURL: 'https://myapp.com',
        authentication: ['email-and-password', 'passkey'],
        oauth: { providers: ['microsoft', 'google'] },
        plugins: {
          admin: {
            impersonation: true,
            defaultAdmin: { email: 'admin@myapp.com', password: '$ADMIN_PASSWORD' },
          },
          organization: { maxMembersPerOrg: 50 },
          twoFactor: { issuer: 'MyCompany', backupCodes: true },
        },
        emailTemplates: {
          verification: {
            subject: 'Verify your MyCompany email',
            text: 'Hi $name, verify here: $url',
          },
          resetPassword: { subject: 'Reset your password', text: 'Click to reset: $url' },
          magicLink: { subject: 'Sign in to MyCompany', text: 'Click to sign in: $url' },
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
export const hasAuthenticationMethod = (auth: Auth, methodName: string): boolean => {
  return auth.authentication.some((method) => {
    if (typeof method === 'string') {
      return method === methodName
    }
    return method.method === methodName
  })
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
