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
import { buildOrganizationPlugin } from './plugins/organization'
import { buildTwoFactorPlugin } from './plugins/two-factor'
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
 * Schema mapping for Better Auth's drizzle adapter
 *
 * IMPORTANT: The keys MUST be Better Auth's internal model names (user, account, session, etc.)
 * NOT the custom table names. The actual database table name is determined by the Drizzle
 * table definition (e.g., pgTable('_sovrium_auth_users', ...)).
 *
 * This is a critical fix for GitHub issue #5879 - using table names as keys causes
 * the adapter to return wrong records, breaking account linking.
 *
 * See: https://github.com/better-auth/better-auth/issues/5879
 */
const drizzleSchema = {
  user: users,
  session: sessions,
  account: accounts,
  verification: verifications,
  organization: organizations,
  member: members,
  invitation: invitations,
  team: teams,
  teamMember: teamMembers,
  organizationRole: organizationRoles,
  twoFactor: twoFactors,
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
    secret: process.env.AUTH_SECRET,
    database: drizzleAdapter(db, {
      provider: 'pg',
      usePlural: false,
      schema: drizzleSchema,
    }),
    // NOTE: modelName options removed - drizzleSchema uses standard model names
    // and Drizzle pgTable() definitions specify actual database table names
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
      changeEmail: { enabled: true, sendChangeEmailVerification: handlers.verification },
    },
    socialProviders: buildSocialProviders(authConfig),
    plugins: buildAuthPlugins(handlers, authConfig),
    rateLimit: buildRateLimitConfig(),
  })
}

/**
 * Default Better Auth instance for OpenAPI schema generation
 * Uses default configuration (requireEmailVerification: false)
 *
 * For app-specific configuration, use createAuthLayer(authConfig) instead.
 */
export const auth = createAuthInstance()
