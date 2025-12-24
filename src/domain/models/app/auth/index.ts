/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { AuthEmailTemplatesSchema } from './config'
import { EmailAndPasswordConfigSchema } from './methods/email-and-password'
import { MagicLinkConfigSchema } from './methods/magic-link'
import { OAuthConfigSchema } from './oauth'
import { AdminConfigSchema } from './plugins/admin'
import { OrganizationConfigSchema } from './plugins/organization'
import { TwoFactorConfigSchema } from './plugins/two-factor'

// Re-export all auth-related schemas and types for convenient imports
export * from './config'
export * from './methods/email-and-password'
export * from './methods/magic-link'
export * from './oauth'
export * from './plugins/admin'
export * from './plugins/organization'
export * from './plugins/two-factor'

/**
 * Authentication Method Names
 *
 * List of authentication method keys in the flattened schema.
 * Used for validation and helper functions.
 */
const AUTH_METHODS = ['emailAndPassword', 'magicLink', 'oauth'] as const
type AuthMethodName = (typeof AUTH_METHODS)[number]

/**
 * Check if a specific authentication method is enabled
 */
export const isMethodEnabled = (auth: Auth | undefined, method: AuthMethodName): boolean => {
  if (!auth) return false
  const value = auth[method]
  if (typeof value === 'boolean') return value
  return value !== undefined
}

/**
 * Get all enabled authentication method names
 */
export const getEnabledMethods = (auth: Auth | undefined): readonly AuthMethodName[] => {
  if (!auth) return []
  return AUTH_METHODS.filter((method) => isMethodEnabled(auth, method))
}

/**
 * Check if at least one authentication method is enabled
 */
export const hasAnyMethodEnabled = (auth: Auth | undefined): boolean => {
  return getEnabledMethods(auth).length > 0
}

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
 * Structure (flat - all authentication methods and plugins are peer-level):
 * - emailAndPassword: Traditional credential-based authentication (optional)
 * - magicLink: Passwordless email link authentication (optional)
 * - oauth: Social login configuration (optional)
 * - admin: User management and administrative features (optional)
 * - organization: Multi-tenancy and organization management (optional)
 * - twoFactor: TOTP-based two-factor authentication (optional)
 * - emailTemplates: Custom email templates (optional)
 *
 * At least one authentication method must be enabled.
 *
 * OAuth Providers (v1):
 * - google, github, microsoft, slack, gitlab
 * - Credentials loaded from environment variables (e.g., GOOGLE_CLIENT_ID)
 *
 * Plugins (v1 - now at root level):
 * - admin: User management, banning, impersonation
 * - organization: Multi-tenancy, team management
 * - twoFactor: TOTP-based two-factor authentication
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
 * { emailAndPassword: true }
 *
 * // With email verification
 * { emailAndPassword: { requireEmailVerification: true } }
 *
 * // OAuth only
 * { oauth: { providers: ['google', 'github'] } }
 *
 * // Social login with email/password
 * {
 *   emailAndPassword: true,
 *   oauth: { providers: ['google', 'github'] }
 * }
 *
 * // Enterprise setup
 * {
 *   emailAndPassword: { requireEmailVerification: true },
 *   magicLink: true,
 *   oauth: { providers: ['microsoft', 'google'] },
 *   admin: { impersonation: true },
 *   organization: { maxMembersPerOrg: 50 },
 *   twoFactor: { issuer: 'MyCompany', backupCodes: true }
 * }
 * ```
 */
export const AuthSchema = Schema.Struct({
  // ============================================================================
  // Authentication Methods (all equal peers)
  // ============================================================================

  /**
   * Email and password authentication (optional)
   *
   * Traditional credential-based authentication.
   * Can be a boolean (true to enable) or a configuration object.
   *
   * @example
   * ```typescript
   * // Simple enable
   * { emailAndPassword: true }
   *
   * // With configuration
   * { emailAndPassword: { requireEmailVerification: true, minPasswordLength: 12 } }
   * ```
   */
  emailAndPassword: Schema.optional(EmailAndPasswordConfigSchema),

  /**
   * Magic link authentication (optional)
   *
   * Passwordless authentication via email link.
   * Can be a boolean (true to enable) or a configuration object.
   *
   * @example
   * ```typescript
   * // Simple enable
   * { magicLink: true }
   *
   * // With configuration
   * { magicLink: { expirationMinutes: 30 } }
   * ```
   */
  magicLink: Schema.optional(MagicLinkConfigSchema),

  /**
   * OAuth social login configuration (optional)
   *
   * Enable social login with providers like Google, GitHub, etc.
   * OAuth is treated as an authentication method, not a separate category.
   * Credentials are loaded from environment variables.
   *
   * @example
   * ```typescript
   * // Enable Google and GitHub OAuth
   * { oauth: { providers: ['google', 'github'] } }
   * ```
   */
  oauth: Schema.optional(OAuthConfigSchema),

  // ============================================================================
  // Feature Extensions (authentication plugins - now at root level)
  // ============================================================================

  /**
   * Admin plugin configuration (optional)
   *
   * Enable administrative features for user management including banning,
   * impersonation, and custom permissions. Can be a boolean (true to enable)
   * or a configuration object.
   *
   * @example
   * ```typescript
   * // Simple enable
   * { admin: true }
   *
   * // With configuration
   * { admin: { impersonation: true, firstUserAdmin: true } }
   * ```
   */
  admin: Schema.optional(AdminConfigSchema),

  /**
   * Organization plugin configuration (optional)
   *
   * Enable multi-tenancy and organization management. Users can create
   * organizations, invite members, and manage roles. Can be a boolean
   * (true to enable) or a configuration object.
   *
   * @example
   * ```typescript
   * // Simple enable
   * { organization: true }
   *
   * // With configuration
   * { organization: { maxMembersPerOrg: 50, allowMultipleOrgs: true } }
   * ```
   */
  organization: Schema.optional(OrganizationConfigSchema),

  /**
   * Two-factor authentication plugin configuration (optional)
   *
   * Enable TOTP-based two-factor authentication. Users can set up 2FA
   * using authenticator apps. Can be a boolean (true to enable) or a
   * configuration object. Requires emailAndPassword authentication.
   *
   * @example
   * ```typescript
   * // Simple enable
   * { twoFactor: true }
   *
   * // With configuration
   * { twoFactor: { issuer: 'MyApp', backupCodes: true } }
   * ```
   */
  twoFactor: Schema.optional(TwoFactorConfigSchema),

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
   *   emailTemplates: {
   *     verification: {
   *       subject: 'Verify your email for MyApp',
   *       text: 'Hi $name, click here to verify: $url'
   *     },
   *     resetPassword: {
   *       subject: 'Reset your password',
   *       text: 'Click the link to reset your password: $url'
   *     }
   *   }
   * }
   * ```
   */
  emailTemplates: Schema.optional(AuthEmailTemplatesSchema),
}).pipe(
  // Cross-field validation
  Schema.filter((config) => {
    // Check at least one authentication method is enabled
    const hasEmailPassword = config.emailAndPassword !== undefined
    const hasMagicLink = config.magicLink !== undefined
    const hasOAuth = config.oauth !== undefined

    if (!hasEmailPassword && !hasMagicLink && !hasOAuth) {
      return 'At least one authentication method must be enabled (emailAndPassword, magicLink, or oauth)'
    }

    // Validate two-factor requires a primary auth method (emailAndPassword)
    const hasTwoFactor = config.twoFactor
    if (hasTwoFactor && !hasEmailPassword) {
      return 'Two-factor authentication requires emailAndPassword authentication'
    }

    // Validate OAuth has providers (already enforced by NonEmptyArray, but explicit check)
    if (config.oauth && (!config.oauth.providers || config.oauth.providers.length === 0)) {
      return 'OAuth configuration requires at least one provider'
    }

    return undefined
  }),
  Schema.annotations({
    title: 'Authentication Configuration',
    description:
      'Authentication configuration with methods (emailAndPassword, magicLink, oauth), plugins, and email templates. Infrastructure config (secrets, URLs, credentials) is set via environment variables.',
    examples: [
      // Minimal
      { emailAndPassword: true },
      // With email verification
      {
        emailAndPassword: { requireEmailVerification: true },
      },
      // OAuth only
      {
        oauth: { providers: ['google', 'github'] },
      },
      // Social login with email templates
      {
        emailAndPassword: true,
        oauth: { providers: ['google', 'github'] },
        emailTemplates: {
          verification: { subject: 'Verify your email', text: 'Click to verify: $url' },
          resetPassword: { subject: 'Reset your password', text: 'Reset link: $url' },
        },
      },
      // Enterprise setup
      {
        emailAndPassword: { requireEmailVerification: true },
        magicLink: true,
        oauth: { providers: ['microsoft', 'google'] },
        admin: { impersonation: true },
        organization: { allowMultipleOrgs: true },
        twoFactor: { issuer: 'MyCompany', backupCodes: true },
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
export const hasAuthenticationMethod = (auth: Auth, methodName: AuthMethodName): boolean => {
  return isMethodEnabled(auth, methodName)
}

/**
 * Plugin names that can be checked
 */
type PluginName = 'admin' | 'organization' | 'twoFactor'

/**
 * Helper to check if auth has a specific plugin enabled
 */
export const hasPlugin = (auth: Auth, pluginName: PluginName): boolean => {
  const plugin = auth[pluginName]
  if (typeof plugin === 'boolean') return plugin
  return plugin !== undefined
}
