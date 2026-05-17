/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { createAuthMiddleware, APIError } from 'better-auth/api'
import { openAPI } from 'better-auth/plugins'
import { getStrategy, hasStrategy } from '@/domain/models/app/auth'
import { resolvePasswordPolicy } from '@/domain/utils/password-policy'
import { db } from '@/infrastructure/database'
import { isProduction as isProductionEnv } from '@/infrastructure/utils/env'
import { createEmailHandlers } from './email-handlers'
import { buildAdminPlugin } from './plugins/admin'
import { buildEmailOtpPlugin } from './plugins/email-otp'
import { buildMagicLinkPlugin } from './plugins/magic-link'
import { buildOauthServerPlugin } from './plugins/oauth-server'
import { buildOrganizationPlugin } from './plugins/organization'
import { buildTwoFactorPlugin } from './plugins/two-factor'
import {
  users,
  sessions,
  accounts,
  verifications,
  twoFactors,
  organizations,
  members,
  invitations,
  teams,
  teamMembers,
  jwks,
  oauthClients,
  oauthAccessTokens,
  oauthRefreshTokens,
  oauthConsents,
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
export const buildSocialProviders = (authConfig?: Auth) => {
  const oauthStrategy = getStrategy(authConfig, 'oauth')
  if (!oauthStrategy?.providers) return {}

  return oauthStrategy.providers.reduce(
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
  organization: organizations,
  member: members,
  invitation: invitations,
  team: teams,
  teamMember: teamMembers,
  jwks,
  oauthClient: oauthClients,
  oauthAccessToken: oauthAccessTokens,
  oauthRefreshToken: oauthRefreshTokens,
  oauthConsent: oauthConsents,
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
  ...buildMagicLinkPlugin(handlers.magicLink, authConfig),
  ...buildEmailOtpPlugin(handlers.emailOtp, authConfig),
  ...buildOauthServerPlugin(authConfig),
  ...buildOrganizationPlugin(authConfig),
  ...buildTwoFactorPlugin(authConfig),
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
  const strategy = getStrategy(authConfig, 'emailAndPassword')
  const requireEmailVerification = strategy?.requireEmailVerification ?? false
  const policy = resolvePasswordPolicy(authConfig)

  return {
    enabled: hasStrategy(authConfig, 'emailAndPassword'),
    requireEmailVerification,
    sendResetPassword: handlers.passwordReset,
    minPasswordLength: policy.minLength,
    maxPasswordLength: policy.maxLength,
    disableSignUp: authConfig?.allowSignUp === false,
  }
}

type AuthMiddlewareCtx = Parameters<typeof createAuthMiddleware>[0] extends (
  ctx: infer C
) => unknown
  ? C
  : never

/**
 * Strip HTML tags from a string to prevent XSS attacks.
 * Used to sanitize user-provided name fields before storage.
 */
const stripHtmlTags = (input: string): string => input.replace(/<[^>]*>/g, '')

/**
 * Sanitize the name field in request body to prevent XSS.
 * Strips all HTML tags from the name before it reaches Better Auth.
 */
// eslint-disable-next-line functional/prefer-immutable-types
function sanitizeNameField(ctx: AuthMiddlewareCtx) {
  const body = ctx.body as { name?: string }
  if (typeof body?.name === 'string') {
    // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements
    ;(ctx.body as { name: string }).name = stripHtmlTags(body.name)
  }
}

/**
 * Validate admin create-user password length (Better Auth Issue #4651 workaround).
 * The admin plugin doesn't respect emailAndPassword validation settings.
 */
// eslint-disable-next-line functional/prefer-immutable-types
async function validateAdminCreateUserPassword(ctx: AuthMiddlewareCtx) {
  const body = ctx.body as { password?: string }
  if (!body?.password) return
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

/**
 * Extract backup codes from the two-factor enable response.
 * Handles both direct object and Response (when called via HTTP) formats.
 */
async function extractBackupCodes(
  returned: Readonly<{ backupCodes?: readonly string[] }> | Response
): Promise<Readonly<{ backupCodes?: readonly string[] }> | undefined> {
  if (returned instanceof Response) {
    return returned.status === 200
      ? ((await returned.clone().json()) as { backupCodes?: readonly string[] })
      : undefined
  }
  return returned
}

type AuthSessionUser = { email: string; name?: string } | undefined

type TwoFactorBackupCodesHandler = NonNullable<
  ReturnType<typeof createEmailHandlers>['twoFactorBackupCodes']
>

type AccountDeletionHandler = NonNullable<ReturnType<typeof createEmailHandlers>['accountDeletion']>

async function handleTwoFactorEnable(
  ctx: Readonly<Parameters<Parameters<typeof createAuthMiddleware>[0]>[0]>,
  sendBackupCodes: TwoFactorBackupCodesHandler
): Promise<void> {
  const returned = ctx.context.returned as
    | { backupCodes?: readonly string[] }
    | Response
    | undefined
  if (!returned) return
  const data = await extractBackupCodes(returned)
  if (!data?.backupCodes) return
  const user = ctx.context.session?.user as AuthSessionUser
  if (!user?.email) return
  // eslint-disable-next-line functional/no-expression-statements
  await sendBackupCodes({
    email: user.email,
    name: user.name,
    codes: data.backupCodes,
  })
}

async function handleDeleteUser(
  ctx: Readonly<Parameters<Parameters<typeof createAuthMiddleware>[0]>[0]>,
  sendAccountDeletion: AccountDeletionHandler
): Promise<void> {
  const { returned } = ctx.context
  const isSuccess = returned instanceof Response ? returned.status === 200 : returned !== undefined
  if (!isSuccess) return
  const user = ctx.context.session?.user as AuthSessionUser
  if (!user?.email) return
  // eslint-disable-next-line functional/no-expression-statements
  await sendAccountDeletion({ email: user.email, name: user.name })
}

/**
 * Build auth hooks with request validation middleware
 *
 * Validates password length for admin createUser endpoint (Better Auth Issue #4651 workaround).
 * The admin plugin doesn't respect emailAndPassword validation settings.
 *
 * Note: The /change-email endpoint uses Better Auth 1.5's native email enumeration protection,
 * which always returns 200 OK regardless of whether the target email exists.
 */
export function buildAuthHooks(handlers?: Readonly<ReturnType<typeof createEmailHandlers>>) {
  return {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === '/sign-up/email') {
        sanitizeNameField(ctx)
      }
      if (ctx.path === '/admin/create-user') {
        // eslint-disable-next-line functional/no-expression-statements
        await validateAdminCreateUserPassword(ctx)
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path === '/two-factor/enable' && handlers?.twoFactorBackupCodes) {
        // eslint-disable-next-line functional/no-expression-statements
        await handleTwoFactorEnable(ctx, handlers.twoFactorBackupCodes)
      }
      if (ctx.path === '/delete-user' && handlers?.accountDeletion) {
        // eslint-disable-next-line functional/no-expression-statements
        await handleDeleteUser(ctx, handlers.accountDeletion)
      }
    }),
  }
}
/**
 * Connection definition shape consumed by the auth user-create hook for
 * test-mode token seeding. Defined locally (rather than imported from
 * `@/domain/models/app/connections`) so this module stays decoupled from
 * the connections schema — at import time we only need the structural
 * `{ name, type, props }` triple.
 */
type ConnectionForSeed = {
  readonly name: string
  readonly type: string
  readonly props: Record<string, unknown>
}

/**
 * Create Better Auth instance with dynamic configuration.
 *
 * When `connections` is provided, the user-create hook also seeds
 * per-user OAuth tokens for every `oauth2` connection. The seeder
 * no-ops in production (see `test-token-seeder.ts`); it exists so E2E
 * specs can assert against an "as if authorized" database state without
 * driving a real provider round-trip.
 */
export function createAuthInstance(authConfig?: Auth, connections?: readonly ConnectionForSeed[]) {
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
      useSecureCookies: isProductionEnv(),
      disableCSRFCheck: !isProductionEnv(),
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
    hooks: buildAuthHooks(handlers),
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            // eslint-disable-next-line functional/no-expression-statements -- Better Auth databaseHook requires side effect
            await handlers.welcome({ email: user.email, name: user.name })
            // Test-mode auto-seed: production no-ops (the seeder checks
            // NODE_ENV internally) so this stays safe in real deployments.
            // Lazy-imported so the seeder's dependency graph (repositories
            // + crypto) doesn't pull at module load time when no
            // connections are configured.
            if (connections !== undefined && connections.length > 0) {
              const { runSeedTestConnectionTokens } =
                await import('@/infrastructure/connections/test-token-seeder')
              // eslint-disable-next-line functional/no-expression-statements -- Better Auth databaseHook requires side effect
              await runSeedTestConnectionTokens({
                userId: user.id,
                userEmail: user.email,
                connections,
              })
            }
          },
        },
      },
    },
  })
}

/**
 * Default Better Auth instance for OpenAPI schema generation
 * Uses default configuration (requireEmailVerification: false)
 *
 * For app-specific configuration, use createAuthLayer(authConfig) instead.
 */
export const auth = createAuthInstance()
