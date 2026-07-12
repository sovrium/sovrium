/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import {
  buildEnvLookup,
  resolveEnvInValue,
} from '@/application/use-cases/automations/resolve-env-vars'
import { computeCodeChallenge } from '@/domain/utils/auth/pkce'
import { OAUTH_CALLBACK_TIMEOUT_MS } from '@/domain/utils/timeouts'
import { validateOutboundUrl } from '@/infrastructure/utils/validate-outbound-url'
import { withFetchTimeout } from '@/infrastructure/utils/with-fetch-timeout'
import { RESERVED_AUTH_PARAMS, RESERVED_TOKEN_PARAMS, applyExtraParamsExcludingReserved } from './oauth2-reserved-params'
import type { OAuth2AuthCodeProps, OAuth2Props } from './oauth2-props'
import type { App } from '@/domain/models/app'
import type { EnvVars } from '@/domain/models/app/env'

export const resolveOAuth2PropsEnv = <P extends OAuth2Props>(props: P, app: App): P => {
  const envLookup = buildEnvLookup((app as { env?: EnvVars }).env, process.env)
  return resolveEnvInValue(props, envLookup) as P
}

export const isPkceActive = (pkce: OAuth2Props['pkce']): pkce is 'S256' | 'plain' =>
  pkce === 'S256' || pkce === 'plain'

export const buildAuthorizeUrl = (
  props: OAuth2AuthCodeProps,
  state: string,
  codeVerifier: string | undefined
): string => {
  const url = new URL(props.authorizationUrl)
  url.searchParams.set('client_id', props.clientId)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', props.redirectUri)
  url.searchParams.set('scope', (props.scopes ?? []).join(' '))
  url.searchParams.set('state', state)
  if (codeVerifier !== undefined && isPkceActive(props.pkce)) {
    url.searchParams.set('code_challenge', computeCodeChallenge(codeVerifier, props.pkce))
    url.searchParams.set('code_challenge_method', props.pkce)
  }
  if (props.audience !== undefined && props.audience !== '') {
    url.searchParams.set('audience', props.audience)
  }
  applyExtraParamsExcludingReserved(url.searchParams, props.extraAuthParams, RESERVED_AUTH_PARAMS)
  return url.toString()
}

export interface OAuthTokenResponse {
  readonly access_token?: string
  readonly refresh_token?: string
  readonly expires_in?: number
  readonly token_type?: string
}

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
  if (props.audience !== undefined && props.audience !== '') {
    body.set('audience', props.audience)
  }
  applyExtraParamsExcludingReserved(body, props.extraTokenParams, RESERVED_TOKEN_PARAMS)
  return body
}

export const exchangeCodeForToken = async (
  props: OAuth2AuthCodeProps,
  code: string,
  codeVerifier: string | undefined
): Promise<
  | { readonly ok: true; readonly tokens: OAuthTokenResponse }
  | { readonly ok: false; readonly error: string }
> => {
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
