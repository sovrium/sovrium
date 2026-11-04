/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { betterAuth } from 'better-auth'
import { openAPI } from 'better-auth/plugins'
import { hasStrategy } from '@/domain/models/app/auth'
import { resolvePasswordPolicy } from '@/domain/models/app/auth/password-policy'
import { AUTH_COOKIE_PREFIX } from '@/domain/models/app/auth/session-cookie'
import {
  isSignUpOpen,
  resolveRequireEmailVerification,
} from '@/domain/models/app/auth/sign-up-service'
import { parsePlatformSso } from '@/domain/models/process-env/platform-sso'
import { parseServerEnv } from '@/domain/models/process-env/server'
import { resolveAuthSecret } from '@/infrastructure/auth/auth-secret'
import { isEmailConfigured } from '@/infrastructure/process/env'
import {
  isCrossSiteSessionPosture,
  isTransportRelaxed,
} from '@/infrastructure/process/security-posture'
import { buildDeleteUserConfig } from './account-deletion-hooks'
import { ACCOUNT_PREFERENCE_FIELDS } from './account-preferences'
import { runAuthTaskInBackground } from './auth-background-tasks'
import { buildDatabaseHooks } from './auth-database-hooks'
import { buildAuthDatabaseAdapter } from './auth-drizzle-adapter'
import { buildAuthEventPlugin, passwordResetDispatcher } from './auth-event-hooks'
import { buildAuthHooks } from './auth-request-hooks'
import { changeEmailMailers } from './change-email-email-handler'
import { lateApiKeyRevoker, revokingApiKeysOnReset } from './credential-lifecycle-hooks'
import { createEmailHandlers } from './email-handlers'
import { buildAdminPlugin } from './plugins/admin'
import { buildApiKeyPlugin } from './plugins/api-key'
import {
  buildDeviceAuthorizationPlugin,
  type DeviceKeyMinter,
} from './plugins/device-authorization'
import { buildEmailOtpPlugin } from './plugins/email-otp'
import { buildMagicLinkPlugin } from './plugins/magic-link'
import { buildOauthServerPlugin } from './plugins/oauth-server'
import { buildOrganizationPlugin } from './plugins/organization'
import { buildPasskeyPlugin } from './plugins/passkey'
import { buildPlatformSsoPlugin } from './plugins/platform-sso'
import * as ssoPlugin from './plugins/sso'
import { buildTwoFactorPlugin } from './plugins/two-factor'
import { SESSION_ADDITIONAL_FIELDS } from './session-database-hooks'
import { buildSocialProviders } from './social-providers'
import { buildSsoContext, type SsoPluginContext } from './sso-origins'
import { refuseSocialIdentityOnSsoOwnedDomain } from './sso-owned-domain-guard'
import { trustedOriginsOf } from './trusted-origins'
import type { AppMetaForOrg, AuthHookContext } from './auth-database-hooks'
import type { AuthHookPolicies } from '@/application/ports/contracts/auth-hook-policies'
import type { Auth } from '@/domain/models/app/auth'
import type { DatabaseService } from '@/infrastructure/database/drizzle/layer'
import type { DomainContext } from '@/infrastructure/server/domain-runtime'

/** A key minter for a caller that never mints one (unit tests building the plugin list). */
const NO_KEY_MINTER: DeviceKeyMinter = () =>
  Promise.reject(new Error('No auth instance is bound to mint a device API key'))

export const buildAuthPlugins = (
  handlers: Readonly<ReturnType<typeof createEmailHandlers>>,
  authConfig?: Auth,
  ssoContext: SsoPluginContext = { envLookup: {}, baseURL: '' },
  extras: {
    readonly appName?: string
    /** The declared `displayName`, which the two-factor issuer prints before the name. */
    readonly appDisplayName?: string
    readonly mintDeviceKey?: DeviceKeyMinter
    readonly hookContext?: AuthHookContext
    /**
     * The declared base URL (`declaredBaseUrl`) the instance was built with:
     * the passkey relying party derives from the same value as `baseURL`.
     */
    readonly declaredBaseUrl?: string | undefined
  } = {}
) => [
  openAPI({ disableDefaultReference: true }),
  ...buildAdminPlugin(authConfig),
  ...buildApiKeyPlugin(authConfig),
  ...buildDeviceAuthorizationPlugin(authConfig, extras.mintDeviceKey ?? NO_KEY_MINTER),
  ...buildMagicLinkPlugin(handlers.magicLink, authConfig),
  ...buildEmailOtpPlugin(handlers.emailOtp, authConfig),
  ...buildOauthServerPlugin(authConfig),
  ...buildOrganizationPlugin(authConfig),
  ...buildTwoFactorPlugin(
    authConfig,
    extras.appName,
    extras.appDisplayName,
    handlers.twoFactorLockout
  ),
  ...ssoPlugin.buildSsoPlugin(authConfig, ssoContext, extras.hookContext?.policies.writeUserRole),
  // "Sign in with Sovrium Cloud", from the environment only — never `auth.sso`.
  // A partial set is refused at boot (`validateOperatorEnv`): here it is whole or absent.
  ...buildPlatformSsoPlugin(parsePlatformSso(process.env), authConfig),
  ...buildPasskeyPlugin(authConfig, extras.appName, extras.declaredBaseUrl),
  // Last, so `signIn` reads the session the other plugins let the request keep.
  ...(extras.hookContext === undefined ? [] : [buildAuthEventPlugin(extras.hookContext)]),
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
  handlers: Readonly<ReturnType<typeof createEmailHandlers>>,
  hookContext?: AuthHookContext,
  apiKeys: { readonly revoke?: (userId: string) => Promise<unknown> } = {}
) {
  // On by default beside a federated provider, which links accounts by address.
  const requireEmailVerification = resolveRequireEmailVerification(authConfig)
  const policy = resolvePasswordPolicy(authConfig)

  return {
    enabled: hasStrategy(authConfig, 'emailAndPassword'),
    requireEmailVerification,
    sendResetPassword: handlers.passwordReset,
    // A reset ends every session the account held, so one opened with a
    // leaked password does not outlive the reset meant to shut it out.
    revokeSessionsOnPasswordReset: true,
    minPasswordLength: policy.minLength,
    maxPasswordLength: policy.maxLength,
    disableSignUp: !isSignUpOpen(authConfig),
    // Revokes the account's API keys, then fires the `passwordReset`
    // automations, once a reset has stood.
    onPasswordReset: revokingApiKeysOnReset(apiKeys.revoke, passwordResetDispatcher(hookContext)),
  }
}

/**
 * Better Auth `advanced` block — secure cookies + CSRF, gated on TRANSPORT
 * POSTURE (not `NODE_ENV`). On a loopback bind (or with the master
 * `SOVRIUM_ALLOW_INSECURE` opt-out) the posture is relaxed: cookies omit the
 * `Secure` attribute (so `http://localhost` DX works) and CSRF origin-checking
 * is disabled. On a non-loopback bind — signalled by a non-loopback `BASE_URL`
 * / `SOVRIUM_BIND_HOST` — secure cookies are forced ON and CSRF is enforced.
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
    // Every mail Better Auth sends for a request (a sign-in code, a reset
    // link, a verification) goes out after the answer, so the answer takes
    // the same time whether or not the address has an account.
    backgroundTasks: { handler: runAuthTaskInBackground },
    // A front-end on another site (`SOVRIUM_CORS_ORIGINS`) needs the cookie on
    // its credentialed fetches; the data API's cross-site guard takes over the
    // protection `SameSite=Lax` gave. A relaxed posture keeps `Lax`: browsers
    // drop a `SameSite=None` cookie that is not `Secure`.
    ...(isCrossSiteSessionPosture()
      ? { defaultCookieAttributes: { sameSite: 'none' as const, secure: true } }
      : {}),
  }
}

/** The app's name and display name, as the plugins that print them read them. */
const appIdentityExtras = (appMeta: AppMetaForOrg | undefined) => ({
  ...(appMeta?.name === undefined ? {} : { appName: appMeta.name }),
  ...(appMeta?.displayName === undefined ? {} : { appDisplayName: appMeta.displayName }),
})

/** What an auth instance is built with besides its config. */
export interface AuthInstanceWiring {
  /**
   * The application's side of every hook — the last-admin rail, the role and
   * ban reads, the audit records, the auth-event dispatch. Built by the server
   * (`makeAuthHookPolicies`), the one infrastructure area that may name the
   * use-cases behind them; required, because a hook with no rail to consult
   * would be a guard that never refuses.
   */
  readonly policies: AuthHookPolicies
  readonly appMeta?: AppMetaForOrg
  /** The server's resolved services, for the instance that serves HTTP. */
  readonly domainContext?: DomainContext
  /**
   * The database the instance writes through. The engine takes its client at
   * construction, before it serves anything, so the composition hands it in.
   */
  readonly database: DatabaseService
}

/** What the instance's hooks consult, over the client its adapter writes through. */
const authHookContextOf = ({
  policies,
  appMeta,
  domainContext,
  database,
}: AuthInstanceWiring): AuthHookContext => ({
  appMeta,
  domainContext,
  policies,
  database,
})

/** Better Auth's `emailVerification` block: when a link is mailed, and through what. */
const emailVerificationConfig = (
  { requireEmailVerification }: ReturnType<typeof buildEmailAndPasswordConfig>,
  { verification }: ReturnType<typeof changeEmailMailers>
) => ({
  sendOnSignUp: requireEmailVerification,
  autoSignInAfterVerification: true,
  sendVerificationEmail: verification,
})

/**
 * Create Better Auth instance with dynamic configuration.
 *
 * When `authConfig` is set, the organization plugin is enabled and the
 * user/session database hooks auto-enroll users into the single per-app
 * organization so the native team endpoints (`/api/auth/organization/*`)
 * resolve against an active organization.
 */
export function createAuthInstance(authConfig: Auth | undefined, wiring: AuthInstanceWiring) {
  const { policies, appMeta } = wiring
  const hookContext = authHookContextOf(wiring)
  const handlers = createEmailHandlers(authConfig, appMeta?.name, undefined, appMeta?.languages)
  const addressChange = changeEmailMailers(handlers.verification, authConfig, appMeta)
  const keys = lateApiKeyRevoker()
  const emailAndPassword = buildEmailAndPasswordConfig(authConfig, handlers, hookContext, keys)

  const { preBindOrigin: baseURL, baseUrl: declaredBaseUrl } = parseServerEnv(process.env)
  const ssoContext = buildSsoContext(appMeta?.env, baseURL)
  // The device flow mints its API key through this instance's own server API,
  // which exists only once `betterAuth` returns: bound late, read per call.
  const bound: { createApiKey?: DeviceKeyMinter } = {}
  const mintDeviceKey: DeviceKeyMinter = (input) =>
    bound.createApiKey === undefined ? NO_KEY_MINTER(input) : bound.createApiKey(input)

  const instance = betterAuth({
    // Explicit `AUTH_SECRET` first, then a value derived from the root secret.
    // Passing `undefined` here would let Better Auth fall back to its own
    // publicly-documented default outside production, which is the hole
    // `resolveAuthSecret` closes.
    secret: resolveAuthSecret(),
    baseURL,
    database: buildAuthDatabaseAdapter(wiring.database),
    // No modelName options: the Drizzle tables name the actual table names.
    trustedOrigins: trustedOriginsOf(baseURL, authConfig, ssoContext.envLookup),
    advanced: buildAdvancedConfig(),
    emailAndPassword,
    emailVerification: emailVerificationConfig(emailAndPassword, addressChange),
    user: {
      changeEmail: { enabled: true, sendChangeEmailConfirmation: addressChange.confirmation },
      // A social sign-in never joins an account on a domain an identity provider owns.
      validateUserInfo: refuseSocialIdentityOnSsoOwnedDomain(authConfig),
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
        database: wiring.database,
      }),
    },
    socialProviders: buildSocialProviders(authConfig),
    session: { additionalFields: SESSION_ADDITIONAL_FIELDS },
    plugins: buildAuthPlugins(handlers, authConfig, ssoContext, {
      ...appIdentityExtras(appMeta),
      mintDeviceKey,
      hookContext,
      declaredBaseUrl,
    }),
    rateLimit: buildRateLimitConfig(),
    // The server-built policies are the guards' reads, rail and records; the
    // app supplies a preference's languages and the sign-out automations.
    hooks: buildAuthHooks(handlers, authConfig, policies, { hookContext }),
    databaseHooks: buildDatabaseHooks(handlers, authConfig, hookContext),
  })
  // Only `userId` and `name`, and no headers: the API-key plugin's server path,
  // which takes the owner from the body and its grant from that owner's role.
  bound.createApiKey = ({ userId, name }) => instance.api.createApiKey({ body: { userId, name } })
  if (authConfig?.apiKeys) keys.bind(instance.$context)
  return instance
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
