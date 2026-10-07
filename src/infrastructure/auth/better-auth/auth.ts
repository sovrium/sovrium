/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { betterAuth } from 'better-auth'
import { openAPI } from 'better-auth/plugins'
import { getStrategy, hasStrategy } from '@/domain/models/app/auth'
import { resolvePasswordPolicy } from '@/domain/models/app/auth/password-policy'
import { AUTH_COOKIE_PREFIX } from '@/domain/models/app/auth/session-cookie'
import { resolveAuthSecret } from '@/infrastructure/auth/auth-secret'
import { isEmailConfigured } from '@/infrastructure/process/env'
import { isTransportRelaxed } from '@/infrastructure/process/security-posture'
import { buildDeleteUserConfig } from './account-deletion-hooks'
import { ACCOUNT_PREFERENCE_FIELDS, writablePreferenceLanguages } from './account-preferences'
import { buildDatabaseHooks } from './auth-database-hooks'
import { buildAuthDatabaseAdapter } from './auth-drizzle-adapter'
import { buildAuthHooks } from './auth-request-hooks'
import { createEmailHandlers } from './email-handlers'
import { buildAdminPlugin } from './plugins/admin'
import { buildApiKeyPlugin } from './plugins/api-key'
import { buildEmailOtpPlugin } from './plugins/email-otp'
import { buildMagicLinkPlugin } from './plugins/magic-link'
import { buildOauthServerPlugin } from './plugins/oauth-server'
import { buildOrganizationPlugin } from './plugins/organization'
import { buildPasskeyPlugin } from './plugins/passkey'
import * as ssoPlugin from './plugins/sso'
import { buildTwoFactorPlugin } from './plugins/two-factor'
import { SESSION_ADDITIONAL_FIELDS } from './session-database-hooks'
import { buildSocialProviders } from './social-providers'
import type { AppMetaForOrg, AuthHookContext, ConnectionForSeed } from './auth-database-hooks'
import type { Auth } from '@/domain/models/app/auth'
import type { DomainContext } from '@/infrastructure/server/domain-runtime'

export const buildAuthPlugins = (
  handlers: Readonly<ReturnType<typeof createEmailHandlers>>,
  authConfig?: Auth,
  ssoContext: ssoPlugin.SsoPluginContext = { envLookup: {}, baseURL: '' },
  appName?: string
) => [
  openAPI({ disableDefaultReference: true }),
  ...buildAdminPlugin(authConfig),
  ...buildApiKeyPlugin(authConfig),
  ...buildMagicLinkPlugin(handlers.magicLink, authConfig),
  ...buildEmailOtpPlugin(handlers.emailOtp, authConfig),
  ...buildOauthServerPlugin(authConfig),
  ...buildOrganizationPlugin(authConfig),
  ...buildTwoFactorPlugin(authConfig),
  ...ssoPlugin.buildSsoPlugin(authConfig, ssoContext),
  ...buildPasskeyPlugin(authConfig, appName),
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

/**
 * Better Auth `advanced` block — secure cookies + CSRF, gated on TRANSPORT
 * POSTURE (not `NODE_ENV`). On a loopback bind (or with the master
 * `SOVRIUM_ALLOW_INSECURE` opt-out) the posture is relaxed: cookies omit the
 * `Secure` attribute (so `http://localhost` DX works) and CSRF origin-checking
 * is disabled. On a non-loopback bind — signalled by a non-loopback `BASE_URL`
 * / `HOSTNAME` — secure cookies are forced ON and CSRF is enforced.
 *
 * `cookiePrefix` is Better Auth's default, pinned explicitly to the shared
 * constant the request-credential predicate recognises the session cookie by:
 * a prefix changed here alone would make every signed-in API request look
 * anonymous to `authMiddleware`.
 */
export function buildAdvancedConfig() {
  const relaxed = isTransportRelaxed()
  return {
    cookiePrefix: AUTH_COOKIE_PREFIX,
    useSecureCookies: !relaxed,
    disableCSRFCheck: relaxed,
  }
}

export function createAuthInstance(
  authConfig?: Auth,
  connections?: readonly ConnectionForSeed[],
  appMeta?: AppMetaForOrg,
  domainContext?: DomainContext
) {
  const hookContext: AuthHookContext = { appMeta, domainContext }
  const handlers = createEmailHandlers(authConfig, appMeta?.name)
  const emailAndPasswordConfig = buildEmailAndPasswordConfig(authConfig, handlers)
  const { requireEmailVerification } = emailAndPasswordConfig

  const baseURL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`
  const ssoContext = ssoPlugin.buildSsoContext(appMeta?.env, baseURL)

  return betterAuth({
    // Explicit `AUTH_SECRET` first, then a value derived from the root secret.
    // Passing `undefined` here would let Better Auth fall back to its own
    // publicly-documented default outside production, which is the hole
    // `resolveAuthSecret` closes.
    secret: resolveAuthSecret(),
    baseURL,
    database: buildAuthDatabaseAdapter(),
    // NOTE: modelName options removed - the drizzle schema map uses standard
    // model names and the Drizzle table definitions specify actual table names
    trustedOrigins: [baseURL, ...ssoPlugin.ssoTrustedOrigins(authConfig, ssoContext.envLookup)],
    advanced: buildAdvancedConfig(),
    emailAndPassword: emailAndPasswordConfig,
    emailVerification: {
      sendOnSignUp: requireEmailVerification,
      autoSignInAfterVerification: true,
      sendVerificationEmail: handlers.verification,
    },
    user: {
      changeEmail: { enabled: true, sendChangeEmailVerification: handlers.verification },
      // The account's own interface language — engine-owned, so no app opts in.
      // `input: true` lets a person set their own through `/update-user`; the
      // VALUE is then checked against the app's declared languages by
      // `applyLanguagePreferenceGuard`, because Better Auth validates an
      // additional field's type and nothing more. The two operator-email
      // switches are engine-owned the same way — see `account-preferences.ts`.
      additionalFields: ACCOUNT_PREFERENCE_FIELDS,
      // Immediate deletion by mailed link, running the scheduled purge's own
      // erasure; `undefined` (a 404 door) when the app closes it or no mail
      // can be sent. See `account-deletion-hooks.ts`.
      deleteUser: buildDeleteUserConfig({
        authConfig,
        emailConfigured: isEmailConfigured(),
        sendConfirmation: handlers.accountDeletion,
        tables: appMeta?.tables,
      }),
    },
    socialProviders: buildSocialProviders(authConfig),
    session: { additionalFields: SESSION_ADDITIONAL_FIELDS },
    plugins: buildAuthPlugins(handlers, authConfig, ssoContext, appMeta?.name),
    rateLimit: buildRateLimitConfig(),
    // `deps` is undefined here on purpose: the admin-role guards resolve their
    // own database access, and only the LANGUAGE guard needs anything from the
    // app — the vocabulary a written preference has to belong to (the host's
    // languages plus the mounted console's, a languages spec).
    hooks: buildAuthHooks(handlers, authConfig, undefined, writablePreferenceLanguages(appMeta)),
    databaseHooks: buildDatabaseHooks(handlers, authConfig, connections, hookContext),
  })
}

export { buildSocialProviders } from './social-providers'

// There is deliberately NO module-level default instance here.
//
// An `export const auth = createAuthInstance()` would be evaluated by every
// importer of the auth barrel — including `sovrium init --help`, which reaches
// it through the CLI's eager import graph. Because the instance resolves a
// signing secret, evaluating it at module load would make a command that only
// describes itself PROVISION a key file as a side effect, and would make that
// command fail outright on a read-only filesystem.
//
// Nothing needs such an instance at runtime: every call site (`openapi-routes`,
// `auth-routes`, `api-routes`, `server`) builds its own via `createAuthInstance`,
// and `layer.ts` needs only its TYPE, which `ReturnType<typeof
// createAuthInstance>` expresses directly.
