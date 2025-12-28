/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { openAPI } from 'better-auth/plugins'
import { db } from '@/infrastructure/database'
import { createEmailHandlers } from './email-handlers'
import { buildAdminPlugin } from './plugins/admin'
import { buildMagicLinkPlugin } from './plugins/magic-link'
import { buildOrganizationPlugin, ORGANIZATION_TABLE_NAMES } from './plugins/organization'
import { buildTwoFactorPlugin, TWO_FACTOR_TABLE_NAME } from './plugins/two-factor'
import {
  users,
  sessions,
  accounts,
  verifications,
  organizations,
  members,
  invitations,
  teams,
  teamMembers,
  organizationRoles,
  twoFactors,
} from './schema'
import type { Auth } from '@/domain/models/app/auth'

/**
 * Build socialProviders configuration from auth config
 *
 * Maps enabled OAuth providers to Better Auth socialProviders configuration.
 * Credentials are loaded from environment variables using the pattern:
 * - {PROVIDER}_CLIENT_ID (e.g., GOOGLE_CLIENT_ID)
 * - {PROVIDER}_CLIENT_SECRET (e.g., GOOGLE_CLIENT_SECRET)
 */
const buildSocialProviders = (authConfig?: Auth) => {
  if (!authConfig?.oauth?.providers) return {}

  return authConfig.oauth.providers.reduce(
    (providers, provider) => {
      const envVarPrefix = provider.toUpperCase()
      return {
        ...providers,
        [provider]: {
          clientId: process.env[`${envVarPrefix}_CLIENT_ID`] || '',
          clientSecret: process.env[`${envVarPrefix}_CLIENT_SECRET`] || '',
        },
      }
    },
    {} as Record<string, { clientId: string; clientSecret: string }>
  )
}

/**
 * Custom table names with _sovrium_auth_ prefix for namespace isolation
 * This prevents conflicts when users create their own tables (e.g., "users" for CRM contacts)
 */
const AUTH_TABLE_NAMES = {
  user: '_sovrium_auth_users',
  session: '_sovrium_auth_sessions',
  account: '_sovrium_auth_accounts',
  verification: '_sovrium_auth_verifications',
  twoFactor: TWO_FACTOR_TABLE_NAME,
  ...ORGANIZATION_TABLE_NAMES,
} as const

/**
 * Schema mapping for Better Auth's drizzle adapter
 *
 * Better Auth looks up schema by modelName, so we need to map:
 * - '_sovrium_auth_users' -> users table definition
 * - '_sovrium_auth_sessions' -> sessions table definition
 * - etc.
 *
 * The keys must match the modelName values used in AUTH_TABLE_NAMES
 */
const drizzleSchema = {
  [AUTH_TABLE_NAMES.user]: users,
  [AUTH_TABLE_NAMES.session]: sessions,
  [AUTH_TABLE_NAMES.account]: accounts,
  [AUTH_TABLE_NAMES.verification]: verifications,
  [AUTH_TABLE_NAMES.organization]: organizations,
  [AUTH_TABLE_NAMES.member]: members,
  [AUTH_TABLE_NAMES.invitation]: invitations,
  [AUTH_TABLE_NAMES.team]: teams,
  [AUTH_TABLE_NAMES.teamMember]: teamMembers,
  [AUTH_TABLE_NAMES.organizationRole]: organizationRoles,
  [AUTH_TABLE_NAMES.twoFactor]: twoFactors,
}

/**
 * Build Better Auth plugins array with custom table names
 *
 * Conditionally includes plugins when enabled in auth configuration.
 * If a plugin is not enabled, its endpoints will not be available (404).
 */
const buildAuthPlugins = (
  handlers: Readonly<ReturnType<typeof createEmailHandlers>>,
  authConfig?: Auth
) => [
  openAPI({ disableDefaultReference: true }),
  ...buildAdminPlugin(authConfig),
  ...buildOrganizationPlugin(handlers.organizationInvitation, authConfig),
  ...buildTwoFactorPlugin(authConfig),
  ...buildMagicLinkPlugin(handlers.magicLink, authConfig),
]

/**
 * Build rate limiting configuration for Better Auth
 */
function buildRateLimitConfig() {
  return {
    enabled: true,
    window: 60,
    max: 10,
    customRules: {
      '/admin/*': {
        window: 1,
        max: 2,
      },
    },
  }
}

/**
 * Create Better Auth instance with dynamic configuration
 */
export function createAuthInstance(authConfig?: Auth) {
  const emailAndPasswordConfig =
    authConfig?.emailAndPassword && typeof authConfig.emailAndPassword === 'object'
      ? authConfig.emailAndPassword
      : {}
  const requireEmailVerification = emailAndPasswordConfig.requireEmailVerification ?? false
  const handlers = createEmailHandlers(authConfig)

  return betterAuth({
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_BASE_URL,
    database: drizzleAdapter(db, {
      provider: 'pg',
      usePlural: false,
      schema: drizzleSchema,
    }),
    session: { modelName: AUTH_TABLE_NAMES.session },
    account: { modelName: AUTH_TABLE_NAMES.account },
    verification: { modelName: AUTH_TABLE_NAMES.verification },
    trustedOrigins: ['*'],
    advanced: {
      useSecureCookies: process.env.NODE_ENV === 'production',
      disableCSRFCheck: process.env.NODE_ENV !== 'production',
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification,
      sendResetPassword: handlers.passwordReset,
    },
    emailVerification: {
      sendOnSignUp: requireEmailVerification,
      autoSignInAfterVerification: true,
      sendVerificationEmail: handlers.verification,
    },
    user: {
      modelName: AUTH_TABLE_NAMES.user,
      changeEmail: { enabled: true, sendChangeEmailVerification: handlers.verification },
    },
    socialProviders: buildSocialProviders(authConfig),
    plugins: buildAuthPlugins(handlers, authConfig),
    rateLimit: buildRateLimitConfig(),
  })
}

/**
 * Lazy-initialized Better Auth instance for OpenAPI schema generation
 * Uses default configuration (requireEmailVerification: false)
 *
 * Lazy initialization prevents module-level instance from being created
 * before dynamic instances, which could interfere with Better Auth's
 * internal state.
 */
// eslint-disable-next-line functional/no-let, unicorn/no-null, functional/prefer-immutable-types -- Lazy initialization pattern
let _defaultAuthInstance: ReturnType<typeof createAuthInstance> | null = null

// eslint-disable-next-line functional/prefer-immutable-types -- Return type from betterAuth is mutable
export function getDefaultAuthInstance(): ReturnType<typeof createAuthInstance> {
  if (_defaultAuthInstance === null) {
    // eslint-disable-next-line functional/no-expression-statements -- Lazy initialization pattern
    _defaultAuthInstance = createAuthInstance()
  }
  return _defaultAuthInstance
}

// Keep for backward compatibility but mark as lazy
export const auth = {
  get api() {
    return getDefaultAuthInstance().api
  },
  get handler() {
    return getDefaultAuthInstance().handler
  },
}
