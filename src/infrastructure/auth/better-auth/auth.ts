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
  // eslint-disable-next-line boundaries/dependencies -- Better Auth databaseHooks fire from within the auth library's lifecycle; the infrastructure-auth layer is the only point where we can observe signUp/emailVerified events. The application-layer use case is the dispatch contract that routes through the AU-02 scheduler — same shape as the record-event trigger bridge.
} from '@/application/use-cases/automations/trigger-auth-event'
import { getStrategy, hasStrategy } from '@/domain/models/app/auth'
import { parseDatabaseDialectConfig } from '@/domain/models/env/database/database-dialect'
import { resolvePasswordPolicy } from '@/domain/utils/auth/password-policy'
import { stripHtmlToText } from '@/domain/utils/html-sanitization'
import { resolveAuthSecret } from '@/infrastructure/auth/auth-secret'
import { provideAutomationRuntime } from '@/infrastructure/automations/runtime-layer'
import { db } from '@/infrastructure/database'
import * as authOauthResourceSqlite from '@/infrastructure/database/drizzle/schema-sqlite/auth-oauth-resource-tables'
import * as authSchemaSqlite from '@/infrastructure/database/drizzle/schema-sqlite/auth-tables'
import { logError } from '@/infrastructure/logging/logger'
import { isTransportRelaxed } from '@/infrastructure/utils/security-posture'
import { withDriverErrorMessages } from './adapter-errors'
import { applyAdminRoleGuards } from './admin-role-guards'
import { applyAvatarUrlGuard } from './avatar-url-guard'
import { createEmailHandlers } from './email-handlers'
import { SOVRIUM_ORGANIZATION_ID, ensureMembership, ensureOrganization } from './org-team-seeder'
import { buildAdminPlugin } from './plugins/admin'
import { buildApiKeyPlugin } from './plugins/api-key'
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
  apiKeys,
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
  oauthResources,
  oauthClientResources,
  oauthClientAssertions,
} from './schema'
import type { AuthHookDeps } from './admin-role-guards'
import type { App } from '@/domain/models/app'
import type { Auth } from '@/domain/models/app/auth'
import type { AdminRoleResolvable } from '@/domain/models/app/auth/roles'

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
 * Schema mapping for Better Auth's drizzle adapter (PostgreSQL).
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
const drizzleSchemaPg = {
  user: users,
  session: sessions,
  account: accounts,
  verification: verifications,
  twoFactor: twoFactors,
  // Model name is `apikey` (one word, no separator) — the plugin's own
  // `API_KEY_TABLE_NAME`. The PHYSICAL table is `auth.api_key`; the key here is
  // what the adapter resolves against (GitHub #5879).
  apikey: apiKeys,
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
  oauthResource: oauthResources,
  oauthClientResource: oauthClientResources,
  oauthClientAssertion: oauthClientAssertions,
}

/**
 * Schema mapping for Better Auth's drizzle adapter (SQLite).
 *
 * Exact mirror of `drizzleSchemaPg` — same Better Auth model-name keys — but
 * pointed at the sqlite-core auth tables (`auth_user`, `auth_session`, …) from
 * the parallel `schema-sqlite/` tree. SQLite has no schemas, so the
 * `pgSchema('auth')` namespace is a flat `auth_` table-name prefix instead;
 * `boolean` columns are `integer({ mode: 'boolean' })`. The model-name keys are
 * what the adapter resolves against (GitHub #5879), so they are identical.
 */
const drizzleSchemaSqlite = {
  user: authSchemaSqlite.users,
  session: authSchemaSqlite.sessions,
  account: authSchemaSqlite.accounts,
  verification: authSchemaSqlite.verifications,
  twoFactor: authSchemaSqlite.twoFactors,
  apikey: authSchemaSqlite.apiKeys,
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
  oauthResource: authOauthResourceSqlite.oauthResources,
  oauthClientResource: authOauthResourceSqlite.oauthClientResources,
  oauthClientAssertion: authOauthResourceSqlite.oauthClientAssertions,
}

/**
 * Build the Better Auth Drizzle adapter for the active database dialect.
 *
 * The dialect is resolved once via `parseDatabaseDialectConfig()` — the single
 * source of truth shared with `getDb()`:
 *
 *  - PostgreSQL → `provider: 'pg'` + the pg-core auth `schema` map.
 *  - SQLite     → `provider: 'sqlite'` + the sqlite-core auth `schema` map.
 *
 * The `db` value handed to `drizzleAdapter` is the dialect-correct client — the
 * lazy `db` proxy already resolves to either the `bun-sql` or `bun-sqlite`
 * Drizzle client via `getDb()`. `usePlural` stays `false` for both: the schema
 * keys are Better Auth's singular model names and the physical table names live
 * in the Drizzle table definitions.
 *
 * `better-auth`'s `DrizzleAdapterConfig.schema` is typed as
 * `Record<string, any>`, so both the pg-core and sqlite-core table maps satisfy
 * it without a cast — the existing pg call relied on the same loose typing.
 */
function buildAuthDatabaseAdapter() {
  const { dialect } = parseDatabaseDialectConfig()
  return withDriverErrorMessages(
    dialect === 'postgres'
      ? drizzleAdapter(db, { provider: 'pg', usePlural: false, schema: drizzleSchemaPg })
      : drizzleAdapter(db, { provider: 'sqlite', usePlural: false, schema: drizzleSchemaSqlite })
  )
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
  ...buildApiKeyPlugin(authConfig),
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
 * Sanitize the name field in request body to prevent XSS.
 * Strips all HTML tags from the name before it reaches Better Auth via the
 * canonical `stripHtmlToText` (parser-based — no ad-hoc regex sanitiser).
 */
// eslint-disable-next-line functional/prefer-immutable-types
function sanitizeNameField(ctx: AuthMiddlewareCtx) {
  const body = ctx.body as { name?: string }
  if (typeof body?.name === 'string') {
    // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements
    ;(ctx.body as { name: string }).name = stripHtmlToText(body.name)
  }
}

/**
 * Validate admin create-user password length (Better Auth Issue #4651 workaround).
 * The admin plugin doesn't respect emailAndPassword validation settings.
 *
 * Re-verified against Better Auth 1.6.11 (May 2026, refactor item [internal ref]):
 * STILL REQUIRED. The vendored `admin/routes.ts` `createUser` route hashes
 * `ctx.body.password` directly with no `minPasswordLength`/`maxPasswordLength`
 * check (`createUserBodySchema` declares `password: z.string().optional()` with
 * no length constraints), whereas the sibling `set-user-password` route *does*
 * validate length. The upstream bug is unfixed — keep this `before`-hook guard.
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
    { backupCodes?: readonly string[] } | Response | undefined
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
 * Revoke every session of the user whose password an admin has just set.
 *
 * An admin resets a password for one reason: the old one can no longer be
 * trusted. Leaving the sessions minted under it alive keeps whoever obtained it
 * signed in indefinitely, and the reset that was supposed to lock them out
 * instead only stops them signing in AGAIN. Rotating the credential and
 * rotating what the credential already bought are one action, not two.
 *
 * Unconditional, deliberately. `POST /admin/set-user-password` accepts exactly
 * `{ userId, newPassword }` — its body schema admits nothing else, so a
 * `revokeOtherSessions` flag on the request is parsed away before any handler
 * sees it. Branching on one would produce a condition that is never true and a
 * gap that looks closed. There is also no case for the other branch: an admin
 * who wants to change a password while preserving the sessions is describing
 * the user's own self-service password change, not this endpoint.
 *
 * Runs `after` because Better Auth owns the write. It uses the same
 * `internalAdapter.deleteUserSessions` that the plugin's own `ban-user`,
 * `revoke-user-sessions` and `remove-user` routes call, so revocation stays one
 * mechanism with one set of semantics rather than a parallel Sovrium-side
 * implementation of session teardown.
 *
 * A failed set is left alone: on a 400 or a 404 nothing was rotated, and
 * killing sessions anyway would turn a rejected request into a logout.
 */
async function handleAdminSetUserPassword(
  ctx: Readonly<Parameters<Parameters<typeof createAuthMiddleware>[0]>[0]>
): Promise<void> {
  const { returned } = ctx.context
  const isSuccess = returned instanceof Response ? returned.status === 200 : returned !== undefined
  if (!isSuccess) return
  const userId = (ctx.body as { readonly userId?: unknown } | undefined)?.userId
  if (typeof userId !== 'string' || userId === '') return
  // eslint-disable-next-line functional/no-expression-statements
  await ctx.context.internalAdapter.deleteUserSessions(userId)
}

/**
 * Build auth hooks with request validation middleware
 *
 * Validates password length for admin createUser endpoint (Better Auth Issue #4651 workaround).
 * The admin plugin doesn't respect emailAndPassword validation settings.
 *
 * Also applies the admin role-mutation guards — see {@link applyAdminRoleGuards}:
 * an unassignable role value is a 400, a last-admin demotion is a 409, and an
 * admin-tier impersonation target is a 403. All three run in `before`, because
 * Better Auth owns the write and there is no later interception point.
 *
 * `authConfig` supplies the app's role vocabulary; when it is absent the admin
 * plugin is not registered at all (`buildAdminPlugin` returns `[]`), so those
 * paths 404 before any guard could matter.
 *
 * Note: The /change-email endpoint uses Better Auth 1.5's native email enumeration protection,
 * which always returns 200 OK regardless of whether the target email exists.
 */
export function buildAuthHooks(
  handlers?: Readonly<ReturnType<typeof createEmailHandlers>>,
  authConfig?: Auth,
  deps?: AuthHookDeps
) {
  const roleApp: AdminRoleResolvable = { auth: authConfig }
  return {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === '/sign-up/email') {
        sanitizeNameField(ctx)
      }
      if (ctx.path === '/admin/create-user') {
        // eslint-disable-next-line functional/no-expression-statements
        await validateAdminCreateUserPassword(ctx)
      }
      // Refuse a client-supplied `auth.user.image` on every path that can write
      // it. Better Auth stores that column verbatim and several readers project
      // it into OTHER users' browsers, so this `before` hook is the only point
      // at which the value can be rejected before the row changes.
      applyAvatarUrlGuard(ctx)
      // eslint-disable-next-line functional/no-expression-statements
      await applyAdminRoleGuards(ctx, roleApp, deps)
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
      if (ctx.path === '/admin/set-user-password') {
        // eslint-disable-next-line functional/no-expression-statements
        await handleAdminSetUserPassword(ctx)
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
 * Better Auth `advanced` block — secure cookies + CSRF, gated on TRANSPORT
 * POSTURE (not `NODE_ENV`). On a loopback bind (or with the master
 * `SOVRIUM_ALLOW_INSECURE` opt-out) the posture is relaxed: cookies omit the
 * `Secure` attribute (so `http://localhost` DX works) and CSRF origin-checking
 * is disabled. On a non-loopback bind — signalled by a non-loopback `BASE_URL`
 * / `HOSTNAME` — secure cookies are forced ON and CSRF is enforced.
 */
function buildAdvancedConfig() {
  const relaxed = isTransportRelaxed()
  return {
    useSecureCookies: !relaxed,
    disableCSRFCheck: relaxed,
  }
}

/**
 * Optional app metadata used by the organization/team seeding hooks and the
 * AU-03 auth-event → automation dispatch bridge.
 *
 * Sovrium runs exactly one Better Auth organization per app. The user-create
 * hook auto-enrolls every new user into that single organization (so the
 * organization-plugin team endpoints work), and the session-create hook
 * points each session's `activeOrganizationId` at it. Only the display name
 * is needed for org seeding — the organization id/slug are fixed constants.
 *
 * The `automations` field is consumed by `dispatchAuthEvent` to find
 * matching `trigger.type === 'auth'` automations when Better Auth's
 * lifecycle hooks fire. Callers pass the full `App` (server.ts:191) so
 * structural typing gives both pieces from the same object.
 */
type AppMetaForOrg = {
  readonly name?: string
  readonly automations?: App['automations']
}

/**
 * Effect-to-async bridge for the AU-03 auth-event trigger. Drives the
 * `triggerAuthEventAutomations` use case from the plain-async Better Auth
 * databaseHooks context. Mirrors the fire-and-forget pattern used by the
 * webhook handler — a downstream automation crash must never fail the
 * upstream auth flow, so all errors are swallowed at the boundary with
 * a `console.error` for operator diagnosis.
 *
 * `app` carries `automations` (filtered inside the use case) and `name`
 * (used by `executeAutomationRun`'s logger). When `appMeta` is undefined
 * (the OpenAPI-schema-generation auth instance has no app context), the
 * bridge no-ops so the default export `auth` doesn't crash at module load.
 */
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
    // The use case absorbs its own errors via `Effect.catchAllCause`, so
    // this `.catch` only fires if the runtime layer itself failed to
    // provide (DB unavailable at boot, etc.). Log-only — never throw.
    logError('[automation:auth-event] runtime provision failed', err)
  })
}

/**
 * Build the Better Auth `databaseHooks` block.
 *
 * Hooks installed when auth is configured:
 *  - `session.create.before` points every session's `activeOrganizationId`
 *    at the single per-app organization so the organization-plugin team
 *    endpoints (`/api/auth/organization/*`) resolve.
 *  - `user.create.after` runs the welcome email, auto-enrolls the new user
 *    into that organization, (test-mode only) seeds OAuth tokens, AND
 *    (AU-03) fires any `trigger.type === 'auth'` automations that
 *    subscribe to the `signUp` event.
 *  - `user.update.after` (AU-03) fires `emailVerified` auth-event
 *    automations when the verification flow completes.
 *
 * The `signIn` / `signOut` / `passwordReset` auth-trigger events are
 * scoped out of this change pending dedicated specs — they require a
 * dialect-aware user-row lookup from `session.userId` (signIn/signOut
 * hooks have only the session) and a Better Auth integration point for
 * passwordReset completion (the `sendResetPassword` callback fires at
 * request time, not on reset success). The dispatch helper
 * `dispatchAuthEvent` is event-agnostic so those calls drop in directly
 * when the matching specs land.
 *
 * Extracted from `createAuthInstance` to keep that function under the
 * project-wide `max-lines-per-function` limit.
 */
function buildDatabaseHooks(
  handlers: Readonly<ReturnType<typeof createEmailHandlers>>,
  authConfig: Auth | undefined,
  connections: readonly ConnectionForSeed[] | undefined,
  appMeta: AppMetaForOrg | undefined
) {
  return {
    session: {
      create: {
        // Point every session at the single per-app organization so the
        // native team endpoints resolve against an active organization.
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
          // eslint-disable-next-line functional/no-expression-statements -- Better Auth databaseHook requires side effect
          await handlers.welcome({ email: user.email, name: user.name })
          // Auto-enroll the user into the single per-app organization so the
          // organization-plugin team endpoints (`/api/auth/organization/*`)
          // resolve. Best-effort: a failure here must never block sign-up.
          if (authConfig) {
            try {
              // eslint-disable-next-line functional/no-expression-statements -- seeding side effect
              await ensureOrganization(appMeta?.name ?? 'sovrium')
              // eslint-disable-next-line functional/no-expression-statements -- seeding side effect
              await ensureMembership(user.id)
            } catch {
              // Non-fatal: org enrollment is best-effort.
            }
          }
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
          // AU-03: fire any `trigger.type === 'auth'` automations that
          // subscribe to the `signUp` event. The user object Better Auth
          // hands us already has `id`/`email`/`name` so action templates
          // can read `{{trigger.data.user.email}}` without a DB lookup.
          // Fire-and-forget at the hook boundary — the use case absorbs
          // its own errors so a misconfigured automation never blocks
          // sign-up. AWAIT it here (not bare promise) so the response
          // body the spec asserts (`/api/tables/activity-log/records`
          // already populated) doesn't race the automation dispatch.
          // eslint-disable-next-line functional/no-expression-statements -- Better Auth databaseHook requires side effect
          await dispatchAuthEvent('signUp', user, appMeta)
        },
      },
      update: {
        // AU-03: when `emailVerified` flips false→true (verification flow
        // completion), fire `emailVerified` auth-event automations. The
        // `before`-vs-`after` value diff is not exposed by Better Auth so
        // we conservatively fire on every update where the new value is
        // `true` — duplicates are tolerated (automations are idempotent
        // by `trigger.data.event` envelope). When no auth-trigger
        // automation subscribes to `emailVerified`, `dispatchAuthEvent`
        // exits early via the `automations.length === 0` short-circuit
        // so this hook has zero cost on non-AU-03 apps.
        after: async (user: Readonly<Record<string, unknown>> | null) => {
          // Better Auth invokes this hook with `null` when the update affected
          // no rows — e.g. the admin `set-role` endpoint targeting a
          // non-existent user, which is idempotent and must return 200 with an
          // empty user. Guard so the missing-user path never throws a 500.
          if (user !== null && user['emailVerified'] === true) {
            // eslint-disable-next-line functional/no-expression-statements -- Better Auth databaseHook requires side effect
            await dispatchAuthEvent('emailVerified', user, appMeta)
          }
        },
      },
    },
  }
}

/**
 * Create Better Auth instance with dynamic configuration.
 *
 * When `connections` is provided, the user-create hook also seeds
 * per-user OAuth tokens for every `oauth2` connection. The seeder
 * no-ops in production (see `test-token-seeder.ts`); it exists so E2E
 * specs can assert against an "as if authorized" database state without
 * driving a real provider round-trip.
 *
 * When `authConfig` is set, the organization plugin is enabled and the
 * user/session database hooks auto-enroll users into the single per-app
 * organization so the native team endpoints (`/api/auth/organization/*`)
 * resolve against an active organization.
 */
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
    // Explicit `AUTH_SECRET` first, then a value derived from the root secret.
    // Passing `undefined` here — what this used to do — let Better Auth fall
    // back to its own publicly-documented default outside production, which is
    // the hole `resolveAuthSecret` closes..
    secret: resolveAuthSecret(),
    baseURL,
    database: buildAuthDatabaseAdapter(),
    // NOTE: modelName options removed - the drizzle schema map uses standard
    // model names and the Drizzle table definitions specify actual table names
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
    hooks: buildAuthHooks(handlers, authConfig),
    databaseHooks: buildDatabaseHooks(handlers, authConfig, connections, appMeta),
  })
}

// There is deliberately NO module-level default instance here.
//
// `export const auth = createAuthInstance()` used to sit at this line, and it
// was evaluated by every importer of the auth barrel — including `sovrium init
// --help`, which reaches it through the CLI's eager import graph. Now that the
// instance resolves a signing secret, evaluating it at module load would make a
// command that only describes itself PROVISION a key file as a side effect, and
// would make that command fail outright on a read-only filesystem.
//
// Nothing consumed the instance at runtime: every call site (`openapi-routes`,
// `auth-routes`, `api-routes`, `server`) builds its own via `createAuthInstance`,
// and `layer.ts` referenced it for its TYPE only, which `ReturnType<typeof
// createAuthInstance>` expresses directly.
