/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sso } from '@better-auth/sso'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { toSafeRedirectPath } from '@/domain/kernel/url/redirect-safety'
import { ssoProviderForEmail } from '@/domain/models/app/auth/sso/sso-service'
import { buildEnvLookup, resolveEnvInString } from '@/domain/models/app/env-reference-service'
import { loopbackRequestOrigin } from './loopback-origin'
import { provisionRole } from './sso-account-hooks'
import type { Auth } from '@/domain/models/app/auth'
import type { SsoProvider } from '@/domain/models/app/auth/sso'
import type { BetterAuthPlugin } from 'better-auth'

/**
 * Single sign-on over OpenID Connect and SAML 2.0, for the identity providers
 * declared under `auth.sso` — and only those.
 *
 * Providers reach the plugin as `defaultSSO`. The plugin's own runtime surface
 * for adding, changing, listing and deleting providers (and for verifying a
 * domain) is removed from its endpoint map, so those paths answer 404: who can
 * sign people in is decided by the config file, never over HTTP.
 *
 * `domainVerification` is switched on only for its effect on configured
 * providers: the plugin then treats a provider as authoritative for its
 * `domains`, which is what lets it link an existing account whose address is on
 * one of them, and refuse to link any other (account-takeover guard).
 */

export { guardSsoAccountLink, refuseClosedSsoSignUp } from './sso-account-hooks'

/** The endpoints that would let HTTP mutate or enumerate the providers. */
const MANAGEMENT_ENDPOINTS = new Set([
  'registerSSOProvider',
  'listSSOProviders',
  'getSSOProvider',
  'updateSSOProvider',
  'deleteSSOProvider',
  'requestDomainVerification',
  'verifyDomain',
])

/** What the wrapper needs beyond `auth`: resolved `$env` values and where the app lives. */
export interface SsoPluginContext {
  readonly envLookup: Readonly<Record<string, string>>
  /** `BASE_URL`, without a trailing slash. */
  readonly baseURL: string
}

/** The SSO context of an app: its declared variables resolved, and its base address. */
export const buildSsoContext = (
  env: Parameters<typeof buildEnvLookup>[0],
  baseURL: string
): SsoPluginContext => ({
  envLookup: buildEnvLookup(env, process.env),
  baseURL: baseURL.replace(/\/+$/, ''),
})

const OIDC_DEFAULT_SCOPES = ['openid', 'email', 'profile'] as const

/** The scopes sent: the declared ones, always including `openid`. */
const scopesOf = (provider: SsoProvider): readonly string[] => {
  const declared = provider.oidc?.scopes ?? OIDC_DEFAULT_SCOPES
  return declared.includes('openid') ? declared : ['openid', ...declared]
}

/** Extra claims carried through to `provisionUser`: the one the role mapping reads. */
const extraFieldsOf = (provider: SsoProvider): Record<string, string> =>
  provider.roleMapping === undefined
    ? {}
    : { [provider.roleMapping.claim]: provider.roleMapping.claim }

const toOidcConfig = (provider: SsoProvider, env: SsoPluginContext['envLookup']) => {
  const oidc = provider.oidc!
  const issuer = oidc.issuer.replace(/\/+$/, '')
  return {
    issuer,
    clientId: resolveEnvInString(oidc.clientId, env),
    clientSecret: resolveEnvInString(oidc.clientSecret, env),
    pkce: oidc.pkce ?? true,
    discoveryEndpoint: `${issuer}/.well-known/openid-configuration`,
    scopes: [...scopesOf(provider)],
    mapping: {
      email: oidc.claimMapping?.email ?? 'email',
      name: oidc.claimMapping?.name ?? 'name',
      image: oidc.claimMapping?.image ?? 'picture',
      extraFields: extraFieldsOf(provider),
    },
  }
}

/** Which assertion attributes carry the email and the name, with Sovrium's defaults. */
const samlMappingOf = (provider: SsoProvider) => {
  const declared = provider.saml?.attributeMapping
  return {
    email: declared?.email ?? 'email',
    name: declared?.name ?? 'displayName',
    firstName: declared?.firstName ?? 'firstName',
    lastName: declared?.lastName ?? 'lastName',
    extraFields: extraFieldsOf(provider),
  }
}

const toSamlConfig = (provider: SsoProvider, context: SsoPluginContext) => {
  const saml = provider.saml!
  const resolve = (value: string | undefined): string | undefined =>
    value === undefined ? undefined : resolveEnvInString(value, context.envLookup)
  const spEntityId =
    resolve(saml.spEntityId) ??
    `${context.baseURL}/api/auth/sso/saml2/sp/metadata?providerId=${provider.id}`
  const metadata = resolve(saml.metadata)
  const certs = saml.cert === undefined ? {} : { cert: resolve(saml.cert) }
  return {
    issuer: spEntityId,
    entryPoint: resolve(saml.entryPoint) ?? '',
    ...certs,
    audience: spEntityId,
    callbackUrl: '/',
    wantAssertionsSigned: true,
    idpMetadata:
      metadata === undefined ? { entityID: resolve(saml.entityId) ?? '', ...certs } : { metadata },
    spMetadata: { entityID: spEntityId },
    mapping: samlMappingOf(provider),
  }
}

const toDefaultSso = (provider: SsoProvider, context: SsoPluginContext) => ({
  providerId: provider.id,
  // The plugin reads a comma-separated list; an empty one routes nothing.
  domain: (provider.domains ?? []).join(','),
  ...(provider.type === 'oidc'
    ? { oidcConfig: toOidcConfig(provider, context.envLookup) }
    : { samlConfig: toSamlConfig(provider, context) }),
})

/** The origin of a URL, or `undefined` when it does not parse. */
const originOf = (url: string | undefined): string | undefined => {
  if (url === undefined || url === '') return undefined
  try {
    return new URL(url).origin
  } catch {
    return undefined
  }
}

/**
 * The origins the server fetches from or is posted back from: every OIDC
 * issuer (discovery, keys, token, userinfo — an identity-provider client
 * refuses an untrusted origin as an SSRF guard) and every SAML sign-on URL.
 */
export const ssoTrustedOrigins = (
  authConfig: Auth | undefined,
  envLookup: SsoPluginContext['envLookup']
): readonly string[] =>
  (authConfig?.sso ?? [])
    .map((provider) =>
      originOf(
        resolveEnvInString(
          provider.type === 'oidc'
            ? (provider.oidc?.issuer ?? '')
            : (provider.saml?.entryPoint ?? ''),
          envLookup
        )
      )
    )
    .filter((origin): origin is string => origin !== undefined)

/**
 * Before the sign-in starts: a provider id the config does not declare, or an
 * email no provider owns, answers 404 here — rather than reaching the plugin's
 * database fallback for providers registered at runtime, which Sovrium never
 * stores.
 */
const guardSignInTarget = (providers: readonly SsoProvider[]) =>
  createAuthMiddleware(async (ctx) => {
    const body = (ctx.body ?? {}) as {
      readonly providerId?: unknown
      readonly email?: unknown
      readonly domain?: unknown
    }
    const known =
      typeof body.providerId === 'string'
        ? providers.some((provider) => provider.id === body.providerId)
        : typeof body.email === 'string'
          ? ssoProviderForEmail(providers, body.email) !== undefined
          : typeof body.domain === 'string'
            ? ssoProviderForEmail(providers, `x@${body.domain}`) !== undefined
            : false
    if (!known) {
      throw new APIError('NOT_FOUND', { message: 'No provider found for this sign-in' })
    }
    if (!returnsToThisApp(ctx.body)) {
      throw new APIError('FORBIDDEN', { message: 'Sign-in may only return to this app' })
    }
  })

const RETURN_FIELDS = ['callbackURL', 'errorCallbackURL', 'newUserCallbackURL'] as const

/**
 * Whether every address the sign-in returns to is a path of this app. The
 * identity providers' origins are trusted for fetching their keys and
 * tokens, never as a place to send a user after sign-in — so an absolute URL,
 * or a protocol-relative one, is refused rather than followed.
 */
const returnsToThisApp = (body: unknown): boolean =>
  RETURN_FIELDS.every((field) => {
    const value = (body as Record<string, unknown> | undefined)?.[field]
    return value === undefined || toSafeRedirectPath(value) !== undefined
  })

/**
 * On the callback and the assertion consumer: an existing account is linked
 * on its first SSO sign-in even when its own address was never verified —
 * domain ownership is the authority here (the plugin only links on a provider
 * that owns the address's domain). Scoped to this request's context, so social
 * sign-in keeps Better Auth's default of requiring a verified local address.
 */
const linkOnDomainAuthority = createAuthMiddleware(async () => ({
  context: {
    context: {
      options: { account: { accountLinking: { requireLocalEmailVerified: false } } },
    },
  },
}))

/**
 * On a loopback request without `BASE_URL`, the base address of the SSO flow
 * is read from the request's own `Host` (see `loopbackRequestOrigin`): that is
 * where the browser is, and where the provider must send it back to keep the
 * flow's state cookie in reach.
 */
const baseUrlFromLoopbackHost = createAuthMiddleware(async (ctx) => {
  const origin = loopbackRequestOrigin(ctx.headers)
  return origin === undefined
    ? undefined
    : { context: { context: { baseURL: `${origin}/api/auth` } } }
})

/** Build the SSO plugin for the declared providers; `[]` when there are none. */
export const buildSsoPlugin = (authConfig: Auth | undefined, context: SsoPluginContext) => {
  const providers = authConfig?.sso ?? []
  if (authConfig === undefined || providers.length === 0) return []
  const plugin = sso({
    defaultSSO: providers.map((provider) => toDefaultSso(provider, context)),
    domainVerification: { enabled: true },
    provisionUser: provisionRole(authConfig),
    provisionUserOnEveryLogin: true,
    organizationProvisioning: { disabled: true },
    providersLimit: 0,
  })
  // The overloads type the plugin without its `init` and `hooks`, which it
  // does carry at runtime; read them through Better Auth's own plugin shape.
  const { hooks } = plugin as BetterAuthPlugin
  const endpoints = Object.fromEntries(
    Object.entries(plugin.endpoints).filter(([name]) => !MANAGEMENT_ENDPOINTS.has(name))
  ) as typeof plugin.endpoints
  return [
    {
      ...plugin,
      endpoints,
      hooks: {
        ...hooks,
        before: [
          ...(hooks?.before ?? []),
          {
            matcher: (ctx: { readonly path?: string }) => ctx.path === '/sign-in/sso',
            handler: guardSignInTarget(providers),
          },
          {
            matcher: (ctx: { readonly path?: string }) =>
              ctx.path === '/sign-in/sso' || (ctx.path ?? '').startsWith('/sso/'),
            handler: baseUrlFromLoopbackHost,
          },
          {
            matcher: (ctx: { readonly path?: string }) =>
              (ctx.path ?? '').startsWith('/sso/callback/') ||
              (ctx.path ?? '').startsWith('/sso/saml2/sp/acs/'),
            handler: linkOnDomainAuthority,
          },
        ],
      },
    },
  ]
}
