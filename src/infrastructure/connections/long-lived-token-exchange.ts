/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { OAUTH_CALLBACK_TIMEOUT_MS } from '@/domain/kernel/time/timeouts'
import { validateOutboundUrl } from '@/infrastructure/egress/validate-outbound-url'
import { withFetchTimeout } from '@/infrastructure/egress/with-fetch-timeout'
import type { RefreshResult } from './token-refresh'

/** The client and endpoint a long-lived token exchange is made with. */
export interface LongLivedExchangeProps {
  readonly clientId: string
  readonly clientSecret: string
  readonly tokenUrl: string
}

/**
 * Meta's long-lived token exchange: a GET to the token endpoint with
 * `grant_type=fb_exchange_token`, the app's id and secret and the current
 * token, answered with a token valid about 60 days and no refresh token. Both
 * the short-lived token of the code exchange and a long-lived token nearing
 * its end are exchanged the same way.
 *
 * The request URL carries the client secret — that is how Meta documents it —
 * so it is never logged, and a transport failure is reported by tag only,
 * never by the underlying error message, which could quote the URL.
 */
export const exchangeMetaLongLivedToken = async (
  props: LongLivedExchangeProps,
  currentToken: string
): Promise<RefreshResult> => {
  // SSRF guard, as for every token request: the URL carries the client secret.
  const validation = validateOutboundUrl(props.tokenUrl)
  if (!validation.ok) {
    return { ok: false, error: `exchange_invalid_url_${validation.issue.reason}` }
  }
  const url = new URL(props.tokenUrl)
  url.searchParams.set('grant_type', 'fb_exchange_token')
  url.searchParams.set('client_id', props.clientId)
  url.searchParams.set('client_secret', props.clientSecret)
  url.searchParams.set('fb_exchange_token', currentToken)
  try {
    const response = await withFetchTimeout(
      url.toString(),
      { method: 'GET', headers: { Accept: 'application/json' } },
      OAUTH_CALLBACK_TIMEOUT_MS
    )
    if (!response.ok) {
      const range = response.status >= 400 && response.status < 500 ? '4xx' : '5xx'
      return { ok: false, error: `exchange_endpoint_${range}_${String(response.status)}` }
    }
    const tokens = (await response.json()) as {
      readonly access_token?: unknown
      readonly expires_in?: unknown
    }
    if (typeof tokens.access_token !== 'string' || tokens.access_token === '') {
      return { ok: false, error: 'exchange_response_missing_access_token' }
    }
    return {
      ok: true,
      accessToken: tokens.access_token,
      refreshToken: undefined,
      expiresAt:
        typeof tokens.expires_in === 'number'
          ? new Date(Date.now() + tokens.expires_in * 1000)
          : undefined,
    }
  } catch {
    return { ok: false, error: 'exchange_request_failed' }
  }
}
