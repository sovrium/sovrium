/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared OAuth2 authorization-code helpers reused by BOTH the
 * schema-author-facing runtime routes (`/api/connections/:name/*` in
 * `./index.ts`) AND the admin-tier action routes
 * (`/api/admin/connections/:id|:name/*` in
 * `presentation/api/routes/admin/connections-actions.ts`).
 *
 * These are the pure / single-purpose pieces of the OAuth2 state machine —
 * the authorize-URL builder, the token-exchange body builder, the token
 * exchange itself (SSRF-guarded), and the PKCE-active predicate. Extracting
 * them here keeps the two route surfaces from drifting (DRY) while leaving the
 * route-specific orchestration (session gating, state save/consume, persistence
 * scoping) in each handler file.
 */

import {
  buildEnvLookup,
  resolveEnvInValue,
} from '@/application/use-cases/automations/resolve-env-vars'
import { computeCodeChallenge } from '@/domain/kernel/identity/pkce'
import { OAUTH_CALLBACK_TIMEOUT_MS } from '@/domain/kernel/time/timeouts'
import { validateOutboundUrl } from '@/infrastructure/egress/validate-outbound-url'
import { withFetchTimeout } from '@/infrastructure/egress/with-fetch-timeout'
// prettier-ignore
import { RESERVED_AUTH_PARAMS, RESERVED_TOKEN_PARAMS, applyExtraParamsExcludingReserved } from './oauth2-reserved-params'
import type { OAuth2AuthCodeProps, OAuth2Props } from './oauth2-props'
import type { App } from '@/domain/models/app'
import type { EnvVars } from '@/domain/models/app/env'

/**
 * Resolve `$env.VAR` references in every string leaf of an oauth2 props object
 * against `app.env` (schema `default` fallback) + `process.env`. The connection
 * prop schema documents clientId / clientSecret / redirectUri / tokenUrl /
 * authorizationUrl / audience as "supports $env.VAR", so the OAuth flow MUST
 * resolve them before they reach the provider — otherwise a shipped app that
 * declares its credentials as `$env.GOOGLE_OAUTH_CLIENT_ID` would hand the
 * literal placeholder to Google (which rejects it).
 *
 * Reuses the canonical automation resolver (`buildEnvLookup` +
 * `resolveEnvInValue`, the same path `auth-headers.ts` uses). `resolveEnvInValue`
 * walks all string leaves (incl. the `scopes` string array) and passes
 * non-string / unreferenced values through unchanged — so a connection using
 * literal prop values (every pre-existing oauth2 spec) is unaffected.
 *
 * Generic over the props shape so it preserves `OAuth2Props` vs
 * `OAuth2AuthCodeProps` for the caller (the resolution is value-only — the set
 * of keys and their types are unchanged).
 */
export const resolveOAuth2PropsEnv = <P extends OAuth2Props>(props: P, app: App): P => {
  const envLookup = buildEnvLookup((app as { env?: EnvVars }).env, process.env)
  return resolveEnvInValue(props, envLookup) as P
}

/**
 * PKCE is "active" when the connection requests S256 or plain (i.e. NOT
 * 'none' and NOT undefined). 'none' is an explicit opt-out kept for
 * providers that don't support PKCE; treat it identically to "no pkce".
 */
export const isPkceActive = (pkce: OAuth2Props['pkce']): pkce is 'S256' | 'plain' =>
  pkce === 'S256' || pkce === 'plain'

/**
 * Build the provider authorization URL with the full OAuth2 + PKCE param set.
 * Pure — no I/O. The `code_challenge` is derived from the verifier only when
 * PKCE is active; the verifier itself stays server-side.
 */
export const buildAuthorizeUrl = (
  props: OAuth2AuthCodeProps,
  state: string,
  codeVerifier: string | undefined
): string => {
  const url = new URL(props.authorizationUrl)
  url.searchParams.set('client_id', props.clientId)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', props.redirectUri)
  // Scopes are optional in the schema. Default to empty string so the
  // OAuth provider receives a `scope=` param even when the user didn't
  // request any (some providers reject the request otherwise; others
  // ignore the empty value).
  url.searchParams.set('scope', (props.scopes ?? []).join(' '))
  url.searchParams.set('state', state)
  if (codeVerifier !== undefined && isPkceActive(props.pkce)) {
    url.searchParams.set('code_challenge', computeCodeChallenge(codeVerifier, props.pkce))
    url.searchParams.set('code_challenge_method', props.pkce)
  }
  // Audience: e.g. Auth0 requires this on the authorization endpoint
  // (and also on the token endpoint — see exchangeCodeForToken below).
  if (props.audience !== undefined && props.audience !== '') {
    url.searchParams.set('audience', props.audience)
  }
  // extraAuthParams: arbitrary provider-specific params (e.g. Google's
  // access_type=offline, prompt=consent for refresh-token issuance).
  // Reserved standard params are filtered out — see oauth2-reserved-params.ts.
  applyExtraParamsExcludingReserved(url.searchParams, props.extraAuthParams, RESERVED_AUTH_PARAMS)
  return url.toString()
}

export interface OAuthTokenResponse {
  readonly access_token?: string
  readonly refresh_token?: string
  readonly expires_in?: number
  readonly token_type?: string
}

/**
 * Build the form-encoded body sent to the token endpoint. Extracted so it can
 * be tested in isolation and shared between the runtime + admin callbacks.
 */
export const buildTokenExchangeBody = (
  props: OAuth2AuthCodeProps,
  code: string,
  codeVerifier: string | undefined
): URLSearchParams => {
  const body = new URLSearchParams()
  body.set('grant_type', 'authorization_code')
  body.set('code', code)
  body.set('redirect_uri', props.redirectUri)
  body.set('client_id', props.clientId)
  body.set('client_secret', props.clientSecret)
  if (codeVerifier !== undefined) {
    body.set('code_verifier', codeVerifier)
  }
  // Audience: identical semantics to the authorization endpoint —
  // some providers (Auth0, Okta) require it on /token as well so the
  // returned access-token is bound to the right resource server.
  if (props.audience !== undefined && props.audience !== '') {
    body.set('audience', props.audience)
  }
  // extraTokenParams: provider-specific knobs (e.g. Google's
  // include_granted_scopes=true). Reserved standard params filtered out —
  // see oauth2-reserved-params.ts (mirror of extraAuthParams handling).
  applyExtraParamsExcludingReserved(body, props.extraTokenParams, RESERVED_TOKEN_PARAMS)
  return body
}

/**
 * Exchange an authorization code (+ PKCE verifier) for tokens at the provider
 * `tokenUrl`. SSRF-guarded via `validateOutboundUrl` so a misconfigured
 * `tokenUrl` cannot exchange the auth code against an internal host.
 */
export const exchangeCodeForToken = async (
  props: OAuth2AuthCodeProps,
  code: string,
  codeVerifier: string | undefined
): Promise<
  | { readonly ok: true; readonly tokens: OAuthTokenResponse }
  | { readonly ok: false; readonly error: string }
> => {
  // SSRF guard: a misconfigured `tokenUrl` must not exchange the auth code
  // against an internal host. Mirrors the guard on the refresh path.
  const validation = validateOutboundUrl(props.tokenUrl)
  if (!validation.ok) {
    return { ok: false, error: `token_invalid_url_${validation.issue.reason}` }
  }

  const body = buildTokenExchangeBody(props, code, codeVerifier)

  try {
    const response = await withFetchTimeout(
      props.tokenUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: body.toString(),
      },
      OAUTH_CALLBACK_TIMEOUT_MS
    )
    if (!response.ok) {
      return { ok: false, error: `token_endpoint_${String(response.status)}` }
    }
    const tokens = (await response.json()) as OAuthTokenResponse
    return { ok: true, tokens }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'token_exchange_failed',
    }
  }
}
