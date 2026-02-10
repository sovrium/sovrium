/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { AuthEmailTemplatesSchema } from './config'
import { TwoFactorConfigSchema } from './plugins/two-factor'
import { DefaultRoleSchema, RolesConfigSchema } from './roles'
import { AuthStrategiesSchema, type AuthStrategy } from './strategies'

// Re-export all auth-related schemas and types for convenient imports
export * from './config'
export * from './methods/email-and-password'
export * from './methods/magic-link'
export * from './oauth'
export * from './plugins/admin'
export * from './plugins/two-factor'
export * from './roles'
export * from './strategies'

/**
 * Strategy type names
 */
type StrategyType = 'emailAndPassword' | 'magicLink' | 'oauth'

/**
 * Check if a specific strategy type is present in the strategies array
 */
export const hasStrategy = (auth: Auth | undefined, strategyType: StrategyType): boolean => {
  if (!auth?.strategies) return false
  return auth.strategies.some((s) => s.type === strategyType)
}

/**
 * Get a specific strategy configuration by type
 */
export const getStrategy = <T extends StrategyType>(
  auth: Auth | undefined,
  strategyType: T
): Extract<AuthStrategy, { readonly type: T }> | undefined => {
  if (!auth?.strategies) return undefined
  return auth.strategies.find((s) => s.type === strategyType) as
    | Extract<AuthStrategy, { readonly type: T }>
    | undefined
}

/**
 * Get all strategy type names that are enabled
 */
export const getEnabledStrategies = (auth: Auth | undefined): readonly StrategyType[] => {
  if (!auth?.strategies) return []
  return auth.strategies.map((s) => s.type)
}

// Legacy aliases for backward compatibility during migration
export const isMethodEnabled = (auth: Auth | undefined, method: StrategyType): boolean =>
  hasStrategy(auth, method)

export const getEnabledMethods = (auth: Auth | undefined): readonly StrategyType[] =>
  getEnabledStrategies(auth)

export const hasAnyMethodEnabled = (auth: Auth | undefined): boolean =>
  (auth?.strategies?.length ?? 0) > 0

/**
 * Authentication Configuration Schema
 *
 * Comprehensive authentication configuration supporting all Better Auth features.
 * If this config exists, authentication is enabled.
 * If omitted from the app config, no auth endpoints are available.
 *
 * Admin features (user management, role assignment, impersonation) are always
 * enabled when auth is configured — no separate toggle needed.
 *
 * Infrastructure configuration (secrets, URLs, credentials) is handled via
 * environment variables, not in this schema. See .env.example for details.
 *
 * Structure:
 * - strategies: Array of authentication strategy objects (required, at least one)
 * - roles: Custom role definitions with hierarchy (optional)
 * - defaultRole: Role assigned to new users (optional, defaults to 'member')
 * - twoFactor: TOTP-based two-factor authentication (optional)
 * - emailTemplates: Custom email templates (optional)
 *
 * @example
 * ```typescript
 * // Minimal
 * { strategies: [{ type: 'emailAndPassword' }] }
 *
 * // With custom roles and defaultRole
 * {
 *   strategies: [{ type: 'emailAndPassword', minPasswordLength: 12 }],
 *   defaultRole: 'viewer',
 *   roles: [{ name: 'editor', description: 'Can edit content', level: 30 }]
 * }
 *
 * // Multiple strategies
 * {
 *   strategies: [
 *     { type: 'emailAndPassword' },
 *     { type: 'oauth', providers: ['google', 'github'] }
 *   ]
 * }
 * ```
 */
export const AuthSchema = Schema.Struct({
  // ============================================================================
  // Authentication Strategies (required)
  // ============================================================================

  /**
   * Array of authentication strategies.
   * At least one strategy must be defined. No duplicate types allowed.
   */
  strategies: AuthStrategiesSchema,

  // ============================================================================
  // Role Configuration (optional)
  // ============================================================================

  /**
   * Custom role definitions (optional)
   *
   * Define additional roles beyond the built-in ones (admin, member, viewer).
   * Empty array means only built-in roles are available.
   */
  roles: Schema.optional(RolesConfigSchema),

  /**
   * Default role for new users (optional)
   *
   * Role assigned to users on registration. Defaults to 'member'.
   * Must reference a built-in role or a custom role name.
   */
  defaultRole: Schema.optional(DefaultRoleSchema),

  // ============================================================================
  // Feature Extensions (optional)
  // ============================================================================

  /**
   * Two-factor authentication plugin configuration (optional)
   *
   * Enable TOTP-based two-factor authentication. Users can set up 2FA
   * using authenticator apps. Requires emailAndPassword strategy.
   */
  twoFactor: Schema.optional(TwoFactorConfigSchema),

  /**
   * Email templates for authentication flows (optional)
   *
   * Customize the subject and content of emails sent during authentication.
   * Templates support variable substitution using $variable syntax.
   */
  emailTemplates: Schema.optional(AuthEmailTemplatesSchema),
}).pipe(
  Schema.filter((config) => {
    // Validate two-factor requires emailAndPassword strategy
    if (config.twoFactor) {
      const hasEmailPassword = config.strategies.some((s) => s.type === 'emailAndPassword')
      if (!hasEmailPassword) {
        return 'Two-factor authentication requires emailAndPassword strategy'
      }
    }

    // Validate defaultRole references a defined role (if custom role name)
    if (config.defaultRole && config.roles) {
      const builtInRoles = ['admin', 'member', 'viewer']
      const customRoleNames = config.roles.map((r) => r.name)
      const allValidRoles = [...builtInRoles, ...customRoleNames]
      if (!allValidRoles.includes(config.defaultRole)) {
        return `Default role '${config.defaultRole}' is not a built-in role or defined in auth.roles`
      }
    }

    return undefined
  }),
  Schema.annotations({
    title: 'Authentication Configuration',
    description:
      'Authentication configuration with strategies, roles, and plugins. Admin features are always enabled when auth is configured.',
    examples: [
      { strategies: [{ type: 'emailAndPassword' as const }] },
      {
        strategies: [{ type: 'emailAndPassword' as const, minPasswordLength: 12 }],
        defaultRole: 'viewer',
        roles: [{ name: 'editor', description: 'Can edit content', level: 30 }],
      },
      {
        strategies: [
          { type: 'emailAndPassword' as const },
          { type: 'oauth' as const, providers: ['google', 'github'] },
        ],
      },
    ],
  })
)

/**
 * TypeScript type inferred from AuthSchema
 */
export type Auth = Schema.Schema.Type<typeof AuthSchema>

/**
 * Encoded type of AuthSchema (what goes in before validation)
 */
export type AuthEncoded = Schema.Schema.Encoded<typeof AuthSchema>

/**
 * Helper to check if auth is configured with a specific strategy
 */
export const hasAuthenticationMethod = (auth: Auth, strategyType: StrategyType): boolean =>
  hasStrategy(auth, strategyType)

/**
 * Plugin names that can be checked
 */
type PluginName = 'twoFactor'

/**
 * Helper to check if auth has a specific plugin enabled
 */
export const hasPlugin = (auth: Auth, pluginName: PluginName): boolean => {
  const plugin = auth[pluginName]
  if (typeof plugin === 'boolean') return plugin
  return plugin !== undefined
}
