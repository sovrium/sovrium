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
import { Effect } from 'effect'
import {
  triggerAuthEventAutomations,
  type AuthTriggerEvent,
} from '@/application/use-cases/automations/trigger-auth-event'
import { getStrategy, hasStrategy } from '@/domain/models/app/auth'
import { parseDatabaseDialectConfig } from '@/domain/models/env/database/database-dialect'
import { resolvePasswordPolicy } from '@/domain/utils/auth/password-policy'
import { stripHtmlToText } from '@/domain/utils/html-sanitization'
import { provideAutomationRuntime } from '@/infrastructure/automations/runtime-layer'
import { db } from '@/infrastructure/database'
import * as authSchemaSqlite from '@/infrastructure/database/drizzle/schema-sqlite/auth-tables'
import { isTransportRelaxed } from '@/infrastructure/utils/security-posture'
import { createEmailHandlers } from './email-handlers'
import { SOVRIUM_ORGANIZATION_ID, ensureMembership, ensureOrganization } from './org-team-seeder'
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
import type { App } from '@/domain/models/app'
import type { Auth } from '@/domain/models/app/auth'

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

const drizzleSchemaPg = {
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

const drizzleSchemaSqlite = {
  user: authSchemaSqlite.users,
  session: authSchemaSqlite.sessions,
  account: authSchemaSqlite.accounts,
  verification: authSchemaSqlite.verifications,
  twoFactor: authSchemaSqlite.twoFactors,
  organization: authSchemaSqlite.organizations,
  member: authSchemaSqlite.members,
  invitation: authSchemaSqlite.invitations,
  team: authSchemaSqlite.teams,
  teamMember: authSchemaSqlite.teamMembers,
  jwks: authSchemaSqlite.jwks,
  oauthClient: authSchemaSqlite.oauthClients,
  oauthAccessToken: authSchemaSqlite.oauthAccessTokens,
  oauthRefreshToken: authSchemaSqlite.oauthRefreshTokens,
  oauthConsent: authSchemaSqlite.oauthConsents,
}

function buildAuthDatabaseAdapter() {
  const { dialect } = parseDatabaseDialectConfig()
  return dialect === 'postgres'
    ? drizzleAdapter(db, { provider: 'pg', usePlural: false, schema: drizzleSchemaPg })
    : drizzleAdapter(db, { provider: 'sqlite', usePlural: false, schema: drizzleSchemaSqlite })
}

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

export function buildRateLimitConfig() {
  return {
    enabled: false,
    window: 60,
    max: 100,
  }
}

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

function sanitizeNameField(ctx: AuthMiddlewareCtx) {
  const body = ctx.body as { name?: string }
  if (typeof body?.name === 'string') {
    ;(ctx.body as { name: string }).name = stripHtmlToText(body.name)
  }
}

async function validateAdminCreateUserPassword(ctx: AuthMiddlewareCtx) {
  const body = ctx.body as { password?: string }
  if (!body?.password) return
  const minLength = 8
  const maxLength = 128
  if (body.password.length < minLength) {
    throw new APIError('BAD_REQUEST', {
      message: `Password must be at least ${minLength} characters`,
    })
  }
  if (body.password.length > maxLength) {
    throw new APIError('BAD_REQUEST', {
      message: `Password must not exceed ${maxLength} characters`,
    })
  }
}

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
    { backupCodes?: readonly string[] } | Response | undefined
  if (!returned) return
  const data = await extractBackupCodes(returned)
  if (!data?.backupCodes) return
  const user = ctx.context.session?.user as AuthSessionUser
  if (!user?.email) return
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
  await sendAccountDeletion({ email: user.email, name: user.name })
}

export function buildAuthHooks(handlers?: Readonly<ReturnType<typeof createEmailHandlers>>) {
  return {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === '/sign-up/email') {
        sanitizeNameField(ctx)
      }
      if (ctx.path === '/admin/create-user') {
        await validateAdminCreateUserPassword(ctx)
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path === '/two-factor/enable' && handlers?.twoFactorBackupCodes) {
        await handleTwoFactorEnable(ctx, handlers.twoFactorBackupCodes)
      }
      if (ctx.path === '/delete-user' && handlers?.accountDeletion) {
        await handleDeleteUser(ctx, handlers.accountDeletion)
      }
    }),
  }
}
type ConnectionForSeed = {
  readonly name: string
  readonly type: string
  readonly props: Record<string, unknown>
}

function buildAdvancedConfig() {
  const relaxed = isTransportRelaxed()
  return {
    useSecureCookies: !relaxed,
    disableCSRFCheck: relaxed,
  }
}

type AppMetaForOrg = {
  readonly name?: string
  readonly automations?: App['automations']
}

const dispatchAuthEvent = (
  event: AuthTriggerEvent,
  user: Readonly<Record<string, unknown>>,
  appMeta: AppMetaForOrg | undefined
): Promise<void> => {
  if (!appMeta || !appMeta.automations || appMeta.automations.length === 0) {
    return Promise.resolve()
  }
  const program = triggerAuthEventAutomations({
    app: appMeta as App,
    event,
    user,
    processEnv: process.env,
    userId: typeof user['id'] === 'string' ? (user['id'] as string) : undefined,
  })
  return Effect.runPromise(provideAutomationRuntime(program)).catch((err) => {
    console.error('[automation:auth-event] runtime provision failed', err)
  })
}

function buildDatabaseHooks(
  handlers: Readonly<ReturnType<typeof createEmailHandlers>>,
  authConfig: Auth | undefined,
  connections: readonly ConnectionForSeed[] | undefined,
  appMeta: AppMetaForOrg | undefined
) {
  return {
    session: {
      create: {
        before: async (session: Readonly<Record<string, unknown>>) => {
          if (!authConfig) return undefined
          return {
            data: { ...session, activeOrganizationId: SOVRIUM_ORGANIZATION_ID },
          }
        },
      },
    },
    user: {
      create: {
        after: async (user: Readonly<{ id: string; email: string; name: string }>) => {
          await handlers.welcome({ email: user.email, name: user.name })
          if (authConfig) {
            try {
              await ensureOrganization(appMeta?.name ?? 'sovrium')
              await ensureMembership(user.id)
            } catch {
            }
          }
          if (connections !== undefined && connections.length > 0) {
            const { runSeedTestConnectionTokens } =
              await import('@/infrastructure/connections/test-token-seeder')
            await runSeedTestConnectionTokens({
              userId: user.id,
              userEmail: user.email,
              connections,
            })
          }
          await dispatchAuthEvent('signUp', user, appMeta)
        },
      },
      update: {
        after: async (user: Readonly<Record<string, unknown>> | null) => {
          if (user !== null && user['emailVerified'] === true) {
            await dispatchAuthEvent('emailVerified', user, appMeta)
          }
        },
      },
    },
  }
}

export function createAuthInstance(
  authConfig?: Auth,
  connections?: readonly ConnectionForSeed[],
  appMeta?: AppMetaForOrg
) {
  const handlers = createEmailHandlers(authConfig)
  const emailAndPasswordConfig = buildEmailAndPasswordConfig(authConfig, handlers)
  const { requireEmailVerification } = emailAndPasswordConfig

  const baseURL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`

  return betterAuth({
    secret: process.env.AUTH_SECRET,
    baseURL,
    database: buildAuthDatabaseAdapter(),
    trustedOrigins: [baseURL],
    advanced: buildAdvancedConfig(),
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
    databaseHooks: buildDatabaseHooks(handlers, authConfig, connections, appMeta),
  })
}

export const auth = createAuthInstance()
