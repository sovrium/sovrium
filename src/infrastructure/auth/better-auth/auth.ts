/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { createAuthMiddleware, APIError } from 'better-auth/api'
import { openAPI } from 'better-auth/plugins'
import { db } from '@/infrastructure/database'
import { createEmailHandlers } from './email-handlers'
import { buildAdminPlugin } from './plugins/admin'
import { buildMagicLinkPlugin } from './plugins/magic-link'
import { buildTwoFactorPlugin } from './plugins/two-factor'
import { users, sessions, accounts, verifications, twoFactors } from './schema'
import type { Auth } from '@/domain/models/app/auth'

/**
 * Build socialProviders configuration from auth config
 *
 * Maps enabled OAuth providers to Better Auth socialProviders configuration.
 * Credentials are loaded from environment variables using the pattern:
 * - {PROVIDER}_CLIENT_ID (e.g., GOOGLE_CLIENT_ID)
 * - {PROVIDER}_CLIENT_SECRET (e.g., GOOGLE_CLIENT_SECRET)
 */
export const buildSocialProviders = (authConfig?: Auth) => {
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
  twoFactor: twoFactors,
}

/**
 * Build Better Auth plugins array with custom table names
 *
 * Conditionally includes plugins when enabled in auth configuration.
 * If a plugin is not enabled, its endpoints will not be available (404).
 */
export const buildAuthPlugins = (
  handlers: Readonly<ReturnType<typeof createEmailHandlers>>,
  authConfig?: Auth
) => [
  openAPI({ disableDefaultReference: true }),
  ...buildAdminPlugin(authConfig),
  ...buildTwoFactorPlugin(authConfig),
  ...buildMagicLinkPlugin(handlers.magicLink, authConfig),
]

/**
 * Build rate limiting configuration for Better Auth
 *
 * NOTE: Better Auth's native rate limiting has known issues with customRules not working reliably
 * (see GitHub issues #392, #1891, #2153). As a workaround, Sovrium uses custom Hono middleware
 * in auth-routes.ts to implement endpoint-specific rate limiting for sign-in, sign-up, and
 * password-reset endpoints.
 *
 * This configuration keeps Better Auth's rate limiting disabled to avoid conflicts with the
 * custom middleware implementation.
 */
export function buildRateLimitConfig() {
  return {
    enabled: false, // Disabled in favor of custom Hono middleware
    window: 60,
    max: 100,
  }
}

/**
 * Build email and password configuration from auth config
 */
export function buildEmailAndPasswordConfig(
  authConfig: Auth | undefined,
  handlers: Readonly<ReturnType<typeof createEmailHandlers>>
) {
  const emailAndPasswordConfig =
    authConfig?.emailAndPassword && typeof authConfig.emailAndPassword === 'object'
      ? authConfig.emailAndPassword
      : {}
  const requireEmailVerification = emailAndPasswordConfig.requireEmailVerification ?? false

  return {
    enabled: true,
    requireEmailVerification,
    sendResetPassword: handlers.passwordReset,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  }
}

/**
 * Build auth hooks with password validation middleware
 *
 * Validates password length for admin createUser endpoint (Better Auth Issue #4651 workaround).
 * The admin plugin doesn't respect emailAndPassword validation settings.
 */
export function buildAuthHooks() {
  return {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === '/admin/create-user') {
        const body = ctx.body as { password?: string }
        if (body?.password) {
          const minLength = 8
          const maxLength = 128
          if (body.password.length < minLength) {
            // eslint-disable-next-line functional/no-throw-statements
            throw new APIError('BAD_REQUEST', {
              message: `Password must be at least ${minLength} characters`,
            })
          }
          if (body.password.length > maxLength) {
            // eslint-disable-next-line functional/no-throw-statements
            throw new APIError('BAD_REQUEST', {
              message: `Password must not exceed ${maxLength} characters`,
            })
          }
        }
      }
    }),
  }
}
/**
 * Create Better Auth instance with dynamic configuration
 */
export function createAuthInstance(authConfig?: Auth) {
  const handlers = createEmailHandlers(authConfig)
  const emailAndPasswordConfig = buildEmailAndPasswordConfig(authConfig, handlers)
  const { requireEmailVerification } = emailAndPasswordConfig

  return betterAuth({
    secret: process.env.AUTH_SECRET,
    baseURL: process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`,
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
    emailAndPassword: emailAndPasswordConfig,
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
    hooks: buildAuthHooks(),
  })
}

/**
 * Default Better Auth instance for OpenAPI schema generation
 * Uses default configuration (requireEmailVerification: false)
 *
 * For app-specific configuration, use createAuthLayer(authConfig) instead.
 */
export const auth = createAuthInstance()
