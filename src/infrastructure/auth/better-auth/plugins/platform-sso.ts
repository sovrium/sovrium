/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { APIError, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api'
import { genericOAuth } from 'better-auth/plugins/generic-oauth'
import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyOptions } from 'jose'
import { isAdminTier } from '@/domain/models/app/auth/roles'
import {
  PLATFORM_SSO_PROVIDER_ID,
  PLATFORM_SSO_SCOPES,
  type PlatformSsoConfig,
} from '@/domain/models/process-env/platform-sso'
import { loopbackRequestOrigin } from './loopback-origin'
import type { Auth } from '@/domain/models/app/auth'
import type { BetterAuthPlugin } from 'better-auth'

/**
 * "Sign in with Sovrium Cloud": the hosting platform's OpenID Connect provider,
 * registered beside the app's own sign-in methods from the
 * `SOVRIUM_PLATFORM_SSO_*` environment — never from `auth.sso`, so the decoded
 * config never carries it.
 *
 * What this provider may do is narrower than any provider an app declares:
 *
 * - **It never creates an account.** Sign-up and implicit sign-up are off, and
 *   the account-create hook refuses a user created on its callback.
 * - **It never links by email.** A Cloud user signs in only to the account
 *   already bound to their id (`sub`); implicit linking is switched off on its
 *   callback. The one way to bind an account is the explicit `link-social`,
 *   started by a signed-in admin-tier user, which needs `email_verified`.
 * - **Its ID token is verified here.** Better Auth's generic provider verifies
 *   an ID token only with keys it got from discovery, and this provider is
 *   configured with explicit endpoints so a Cloud outage at boot cannot drop
 *   it. So the identity is read from the ID token after checking its signature
 *   against the Cloud's `<issuer>/jwks`, its issuer, its audience (this app's
 *   client id) and its expiry — never from an unverified token or the
 *   user-info answer alone.
 * - **It keeps nothing of the Cloud's tokens.** The account row binding a user
 *   to the Cloud holds the id and nothing else (see {@link stripPlatformTokens}).
 */

/** The Cloud user a verified ID token names, as Better Auth's provider reads it. */
interface PlatformProfile {
  readonly [claim: string]: unknown
  readonly id: string
  readonly sub: string
  readonly email: string
  readonly emailVerified: boolean
  readonly name: string
  readonly image?: string
}

/** A non-empty string claim, or `undefined`. */
const claimOf = (payload: JWTPayload, name: string): string | undefined => {
  const value = payload[name]
  return typeof value === 'string' && value !== '' ? value : undefined
}

/** `email_verified` as a boolean; a provider may send it as the string `"true"`. */
const isVerified = (payload: JWTPayload): boolean =>
  payload['email_verified'] === true || payload['email_verified'] === 'true'

/**
 * The signatures an ID token may carry: asymmetric ones only, so a key set can
 * never be read as a shared secret, and `none` is never one of them. The
 * Cloud's own provider signs with EdDSA; the others are what an OpenID
 * provider commonly publishes.
 */
const ID_TOKEN_ALGORITHMS: readonly string[] = [
  'EdDSA',
  'ES256',
  'ES384',
  'ES512',
  'RS256',
  'RS384',
  'RS512',
  'PS256',
  'PS384',
  'PS512',
]

/** How far the Cloud's clock may drift from this server's, for `exp`, `iat` and `nbf`. */
const CLOCK_TOLERANCE_SECONDS = 60

/** How long one fetch of the Cloud's key set may take before it is abandoned. */
const JWKS_TIMEOUT_MS = 5000

/** The verification options an ID token of `config`'s Cloud is checked against. */
const verifyOptionsOf = (config: PlatformSsoConfig): JWTVerifyOptions => ({
  issuer: config.issuer,
  audience: config.clientId,
  algorithms: [...ID_TOKEN_ALGORITHMS],
  clockTolerance: CLOCK_TOLERANCE_SECONDS,
  requiredClaims: ['sub', 'exp', 'iat'],
})

/**
 * Whether a verified token was issued to this app: an `aud` naming several
 * clients must say which one it was issued to (`azp`, OpenID Connect Core
 * §3.1.3.7), and that one is this app.
 */
const isIssuedToThisApp = (payload: JWTPayload, clientId: string): boolean =>
  !Array.isArray(payload.aud) || payload.aud.length <= 1 || payload['azp'] === clientId

/** The Cloud user a verified payload names, or `null` when it names none. */
const profileOf = (payload: JWTPayload): PlatformProfile | null => {
  const sub = claimOf(payload, 'sub')
  const email = claimOf(payload, 'email')
  if (sub === undefined || email === undefined) return null
  const image = claimOf(payload, 'picture')
  return {
    id: sub,
    sub,
    email,
    emailVerified: isVerified(payload),
    name: claimOf(payload, 'name') ?? email,
    ...(image === undefined ? {} : { image }),
  }
}

/**
 * Read the Cloud user from the ID token, after verifying it; `null` when there
 * is no ID token or it does not verify, which Better Auth turns into the error
 * redirect — nobody is signed in.
 *
 * The key set is fetched from the configured issuer only, once per engine and
 * not once per sign-in: `jose` keeps it, re-reads it when a token names a key
 * it does not hold (no more than once per cooldown), and abandons a fetch that
 * takes longer than {@link JWKS_TIMEOUT_MS}.
 *
 * No `nonce` is sent or checked. The ID token is never handed over by the
 * browser: the server receives it from the Cloud's token endpoint, over TLS,
 * in exchange for a code bound to this flow's PKCE verifier and to its state
 * cookie, authenticated with the client secret. A token from another flow
 * cannot reach this point, which is what a nonce would prove.
 */
const readVerifiedProfile = (config: PlatformSsoConfig) => {
  const keys = createRemoteJWKSet(new URL(config.endpoints.jwks), {
    timeoutDuration: JWKS_TIMEOUT_MS,
  })
  const options = verifyOptionsOf(config)
  return async (tokens: { readonly idToken?: string }): Promise<PlatformProfile | null> => {
    if (tokens.idToken === undefined || tokens.idToken === '') return null
    try {
      const { payload } = await jwtVerify(tokens.idToken, keys, options)
      return isIssuedToThisApp(payload, config.clientId) ? profileOf(payload) : null
    } catch {
      return null
    }
  }
}

/** Whether a request starting a flow names the platform provider. */
const namesPlatformProvider = (ctx: { readonly path?: string; readonly body?: unknown }): boolean =>
  (ctx.path === '/sign-in/social' || ctx.path === '/link-social') &&
  (ctx.body as { readonly provider?: unknown } | undefined)?.provider === PLATFORM_SSO_PROVIDER_ID

/**
 * Whether a request is the platform provider's callback. Better Auth names the
 * route by its template (`/callback/:id`), the provider by the `id` param.
 */
export const isPlatformCallback = (
  ctx: { readonly path?: string; readonly params?: unknown } | null | undefined
): boolean =>
  (ctx?.path === '/callback/:id' &&
    (ctx.params as { readonly id?: unknown } | undefined)?.id === PLATFORM_SSO_PROVIDER_ID) ||
  ctx?.path === `/callback/${PLATFORM_SSO_PROVIDER_ID}`

/**
 * On the callback: no email-based linking, and the explicit link may bind a
 * Cloud user whose email differs from the account's (the binding is the id).
 * Scoped to this request's context, so every other provider keeps the app's
 * own linking rules.
 */
const bindByIdOnly = createAuthMiddleware(async () => ({
  context: {
    context: {
      options: {
        account: {
          accountLinking: { disableImplicitLinking: true, allowDifferentEmails: true },
        },
      },
    },
  },
}))

/**
 * On a loopback request without `BASE_URL`, the flow's base address is the
 * request's own `Host` — where the browser is, and where the Cloud must send
 * it back to keep the flow's state cookie in reach (the same rule as `auth.sso`).
 */
const baseUrlFromLoopbackHost = createAuthMiddleware(async (ctx) => {
  const origin = loopbackRequestOrigin(ctx.headers)
  return origin === undefined
    ? undefined
    : { context: { context: { baseURL: `${origin}/api/auth` } } }
})

/**
 * Before `link-social` starts a link to the Cloud: only an admin-tier user may
 * bind their account, and an account binds one Cloud user at most. Anyone else
 * is answered 404, as if the provider did not exist.
 */
const guardPlatformLink = (authConfig: Auth | undefined) =>
  createAuthMiddleware(async (ctx) => {
    const session = await getSessionFromCtx(ctx)
    const role = (session?.user as { readonly role?: unknown } | undefined)?.role
    if (session === null || typeof role !== 'string' || !isAdminTier(role, { auth: authConfig })) {
      throw new APIError('NOT_FOUND', { message: 'No provider found for this link' })
    }
    const held = await ctx.context.internalAdapter.findAccounts(session.user.id)
    if (held.some((account) => account.providerId === PLATFORM_SSO_PROVIDER_ID)) {
      throw new APIError('CONFLICT', {
        message: 'This account is already connected to a Sovrium Cloud account',
      })
    }
  })

/** The platform provider plugin, or `[]` when the environment sets none. */
export const buildPlatformSsoPlugin = (
  config: PlatformSsoConfig | undefined,
  authConfig: Auth | undefined
): BetterAuthPlugin[] => {
  if (config === undefined) return []
  const plugin = genericOAuth({
    config: [
      {
        providerId: PLATFORM_SSO_PROVIDER_ID,
        name: config.name,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        authorizationUrl: config.endpoints.authorization,
        tokenUrl: config.endpoints.token,
        userInfoUrl: config.endpoints.userInfo,
        authentication: 'post',
        scopes: [...PLATFORM_SSO_SCOPES],
        pkce: true,
        disableSignUp: true,
        disableImplicitSignUp: true,
        getUserInfo: readVerifiedProfile(config),
      },
    ],
  }) as BetterAuthPlugin
  return [
    {
      ...plugin,
      hooks: {
        before: [
          {
            matcher: (ctx) => ctx.path === '/link-social' && namesPlatformProvider(ctx),
            handler: guardPlatformLink(authConfig),
          },
          {
            matcher: (ctx) => namesPlatformProvider(ctx) || isPlatformCallback(ctx),
            handler: baseUrlFromLoopbackHost,
          },
          { matcher: (ctx) => isPlatformCallback(ctx), handler: bindByIdOnly },
        ],
      },
    },
  ]
}
