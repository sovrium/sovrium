/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isNativeHttpLoopbackOrigin } from '@/domain/kernel/url/oauth-loopback'

/**
 * The environment of an app hosted on Sovrium Cloud that signs its admins in
 * with their Sovrium Cloud account ("Sign in with Sovrium Cloud").
 *
 * The Cloud writes these variables for every app it hosts; a self-hosted app
 * sets none of them, and its config never sees the provider they describe. The
 * provider is registered beside the app's own sign-in methods, never as an
 * `auth.sso` entry, so it is absent from the decoded config.
 *
 * `ISSUER`, `CLIENT_ID` and `CLIENT_SECRET` go together. `ADMIN_SUBJECT` (the
 * Cloud user id of the app's owner, which seeds the first admin of an app with
 * no user) is optional, and only meaningful beside the first three. There is
 * no name variable: the console button is translated text, and the provider's
 * name is internal. Any other combination is refused at boot.
 */

type Env = Readonly<Record<string, string | undefined>>

/** Every platform sign-in variable starts with this; an app's config cannot declare one. */
export const SOVRIUM_PLATFORM_SSO_PREFIX = 'SOVRIUM_PLATFORM_SSO_'

export const SOVRIUM_PLATFORM_SSO_ISSUER_VAR = 'SOVRIUM_PLATFORM_SSO_ISSUER'
export const SOVRIUM_PLATFORM_SSO_CLIENT_ID_VAR = 'SOVRIUM_PLATFORM_SSO_CLIENT_ID'
export const SOVRIUM_PLATFORM_SSO_CLIENT_SECRET_VAR = 'SOVRIUM_PLATFORM_SSO_CLIENT_SECRET'
export const SOVRIUM_PLATFORM_SSO_ADMIN_SUBJECT_VAR = 'SOVRIUM_PLATFORM_SSO_ADMIN_SUBJECT'

/** The provider id the platform sign-in registers. An `auth.sso` entry cannot take it. */
export const PLATFORM_SSO_PROVIDER_ID = 'sovrium-cloud'

/**
 * The provider's internal name (genericOAuth `name`). No screen shows it: the
 * console button reads its own translated label.
 */
export const PLATFORM_SSO_DEFAULT_NAME = 'Sovrium Cloud'

/** The scopes every platform sign-in asks for, and nothing more. */
export const PLATFORM_SSO_SCOPES: readonly string[] = ['openid', 'email', 'profile']

/** The variables that must be set together. */
const REQUIRED_VARS: readonly string[] = [
  SOVRIUM_PLATFORM_SSO_ISSUER_VAR,
  SOVRIUM_PLATFORM_SSO_CLIENT_ID_VAR,
  SOVRIUM_PLATFORM_SSO_CLIENT_SECRET_VAR,
]

/** The variables that only make sense beside the required ones. */
const OPTIONAL_VARS: readonly string[] = [SOVRIUM_PLATFORM_SSO_ADMIN_SUBJECT_VAR]

/**
 * The Cloud's endpoints, derived from its issuer — never discovered at boot,
 * so a Cloud that is unreachable when the app starts cannot drop the provider.
 * They are the paths a Sovrium Cloud serves below its `/api/auth` issuer.
 */
export interface PlatformSsoEndpoints {
  readonly authorization: string
  readonly token: string
  readonly userInfo: string
  /** The key set the Cloud's ID tokens are verified against. */
  readonly jwks: string
}

/** The platform sign-in, read from the environment. */
export interface PlatformSsoConfig {
  readonly providerId: typeof PLATFORM_SSO_PROVIDER_ID
  /** The issuer, without a trailing slash; the ID token's `iss` must equal it. */
  readonly issuer: string
  /** This app's client id at the Cloud; the ID token's `aud` must contain it. */
  readonly clientId: string
  readonly clientSecret: string
  /** The Cloud user id that seeds the first admin of an empty app, when set. */
  readonly adminSubject: string | undefined
  readonly name: string
  readonly endpoints: PlatformSsoEndpoints
}

/** The value of a variable, trimmed, or `undefined` when unset or empty. */
const valueOf = (env: Env, name: string): string | undefined => {
  const raw = env[name]?.trim() ?? ''
  return raw === '' ? undefined : raw
}

/**
 * Why `raw` cannot be the issuer, or `undefined` when it can: an absolute
 * `https` URL — `http` on a loopback host only — with no query, fragment or
 * credentials. Never echoes the value back.
 */
export const platformSsoIssuerProblem = (raw: string): string | undefined => {
  const url = URL.parse(raw)
  if (url === null) return 'is not an absolute URL'
  if (url.protocol !== 'https:' && !isNativeHttpLoopbackOrigin(url.origin))
    return 'must use https (http is allowed on a loopback host only)'
  if (url.search !== '' || url.hash !== '') return 'must not carry a query or a fragment'
  if (url.username !== '' || url.password !== '') return 'must not carry credentials'
  return undefined
}

/** The Cloud's endpoints below its issuer. */
export const platformSsoEndpoints = (issuer: string): PlatformSsoEndpoints => ({
  authorization: `${issuer}/oauth2/authorize`,
  token: `${issuer}/oauth2/token`,
  userInfo: `${issuer}/oauth2/userinfo`,
  jwks: `${issuer}/jwks`,
})

const refuse = (message: string): never => {
  // eslint-disable-next-line functional/no-throw-statements -- a boot-time refusal: the caller turns it into a startup failure before the port binds.
  throw new Error(message)
}

/** `is` for one name, `are` for several. */
const verbFor = (names: readonly string[]): string => (names.length === 1 ? 'is' : 'are')

/** The refusal of a partial set: what is set and what is missing, by name only. */
const partialSetRefusal = (set: readonly string[], missing: readonly string[]): string =>
  `Sign in with Sovrium Cloud needs ${REQUIRED_VARS.join(', ')} together; ${set.join(', ')} ${verbFor(set)} set but ${missing.join(', ')} ${verbFor(missing)} not.`

/**
 * The platform sign-in, or `undefined` when none of its variables is set — a
 * self-hosted app. A partial set, or an issuer that is not an https address,
 * is refused: the message names the variables and never prints a value.
 */
export const parsePlatformSso = (env: Env = process.env): PlatformSsoConfig | undefined => {
  const set = [...REQUIRED_VARS, ...OPTIONAL_VARS].filter(
    (name) => valueOf(env, name) !== undefined
  )
  if (set.length === 0) return undefined
  const missing = REQUIRED_VARS.filter((name) => valueOf(env, name) === undefined)
  if (missing.length > 0) return refuse(partialSetRefusal(set, missing))
  const issuer = (valueOf(env, SOVRIUM_PLATFORM_SSO_ISSUER_VAR) ?? '').replace(/\/+$/, '')
  const problem = platformSsoIssuerProblem(issuer)
  if (problem !== undefined) return refuse(`${SOVRIUM_PLATFORM_SSO_ISSUER_VAR} ${problem}.`)
  return {
    providerId: PLATFORM_SSO_PROVIDER_ID,
    issuer,
    clientId: valueOf(env, SOVRIUM_PLATFORM_SSO_CLIENT_ID_VAR) ?? '',
    clientSecret: valueOf(env, SOVRIUM_PLATFORM_SSO_CLIENT_SECRET_VAR) ?? '',
    adminSubject: valueOf(env, SOVRIUM_PLATFORM_SSO_ADMIN_SUBJECT_VAR),
    name: PLATFORM_SSO_DEFAULT_NAME,
    endpoints: platformSsoEndpoints(issuer),
  }
}

/** Whether an environment variable name belongs to the platform sign-in. */
export const isPlatformSsoVariable = (name: string): boolean =>
  name.startsWith(SOVRIUM_PLATFORM_SSO_PREFIX)
