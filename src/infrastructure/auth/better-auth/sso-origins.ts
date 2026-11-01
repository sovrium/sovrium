/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The SSO pieces the cross-site origin list needs, kept apart from the SSO
 * plugin: this module imports no `better-auth` package, so a server whose app
 * declares no sign-in can compute its trusted origins without loading the
 * identity library.
 */

import { buildEnvLookup, resolveEnvInString } from '@/domain/models/app/env-reference-service'
import type { Auth } from '@/domain/models/app/auth'

/** What the SSO plugin wrapper needs beyond `auth`: resolved `$env` values and where the app lives. */
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
