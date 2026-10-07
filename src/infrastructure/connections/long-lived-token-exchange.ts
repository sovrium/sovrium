/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { OAUTH_CALLBACK_TIMEOUT_MS } from '@/domain/kernel/time/timeouts'
import {
  guardedFetch,
  guardedText,
  TOKEN_RESPONSE_MAX_BYTES,
} from '@/infrastructure/egress/guarded-fetch'
import { validateOutboundUrl } from '@/infrastructure/egress/validate-outbound-url'
import type {
  LongLivedExchangeProps,
  RefreshResult,
} from '@/application/ports/services/oauth-token-client'
import type { GuardedResponse } from '@/infrastructure/egress/guarded-fetch'

/**
 * Read Meta's answer: the long-lived token and its lifetime. An answer cut at
 * the size cap is reported as too large rather than handed to the JSON parser.
 */
const readExchangeAnswer = (response: GuardedResponse): RefreshResult => {
  if (response.truncated) return { ok: false, error: 'exchange_response_too_large' }
  const tokens = JSON.parse(guardedText(response)) as {
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
    // Every redirect hop passes the guard too: the URL carries the secret.
    const sent = await guardedFetch(
      url,
      { method: 'GET', headers: { Accept: 'application/json' } },
      { timeoutMs: OAUTH_CALLBACK_TIMEOUT_MS, maxBodyBytes: TOKEN_RESPONSE_MAX_BYTES }
    )
    if (!sent.ok) return { ok: false, error: `exchange_invalid_url_${sent.reason}` }
    const { response } = sent
    if (!response.ok) {
      const range = response.status >= 400 && response.status < 500 ? '4xx' : '5xx'
      return { ok: false, error: `exchange_endpoint_${range}_${String(response.status)}` }
    }
    return readExchangeAnswer(response)
  } catch {
    return { ok: false, error: 'exchange_request_failed' }
  }
}
