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
import type {
  TokenExchangeRequest,
  TokenExchangeResult,
} from '@/application/ports/services/oauth-token-client'

/** An answer without a lifetime is kept for one hour. */
const DEFAULT_LIFETIME_SECONDS = 3600

const readPath = (value: unknown, path: string): unknown =>
  path
    .split('.')
    .reduce<unknown>(
      (current, segment) =>
        current !== null && typeof current === 'object'
          ? (current as Record<string, unknown>)[segment]
          : undefined,
      value
    )

const lifetimeSeconds = (raw: unknown): number => {
  const seconds = typeof raw === 'string' ? Number(raw) : raw
  return typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0
    ? seconds
    : DEFAULT_LIFETIME_SECONDS
}

const encodeBody = (
  request: TokenExchangeRequest
): { readonly contentType: string; readonly payload: string } =>
  request.bodyType === 'form'
    ? {
        contentType: 'application/x-www-form-urlencoded',
        payload: new URLSearchParams(Object.entries(request.body)).toString(),
      }
    : { contentType: 'application/json', payload: JSON.stringify(request.body) }

/**
 * Exchange a stored credential for a short-lived token at an endpoint that is
 * not an OAuth2 token endpoint (Spendesk and similar): POST the credential as
 * JSON or as a form, read the token and its lifetime from the answer by dot
 * path. The body carries secrets, so the request and every redirect it follows
 * pass the outbound-address guard, and a transport failure is reported by tag,
 * never by message.
 */
export const requestExchangedToken = async (
  request: TokenExchangeRequest
): Promise<TokenExchangeResult> => {
  const { contentType, payload } = encodeBody(request)
  try {
    const sent = await guardedFetch(
      request.tokenUrl,
      {
        method: 'POST',
        headers: { 'Content-Type': contentType, Accept: 'application/json' },
        body: payload,
      },
      { timeoutMs: OAUTH_CALLBACK_TIMEOUT_MS, maxBodyBytes: TOKEN_RESPONSE_MAX_BYTES }
    )
    if (!sent.ok) return { ok: false, error: `token_invalid_url_${sent.reason}` }
    const { response } = sent
    if (!response.ok) {
      const range = response.status >= 400 && response.status < 500 ? '4xx' : '5xx'
      return { ok: false, error: `token_endpoint_${range}_${String(response.status)}` }
    }
    if (response.truncated) return { ok: false, error: 'token_response_too_large' }
    const answer: unknown = JSON.parse(guardedText(response))
    const token = readPath(answer, request.tokenPath)
    if (typeof token !== 'string' || token === '') {
      return { ok: false, error: 'token_response_missing_token' }
    }
    const seconds = lifetimeSeconds(readPath(answer, request.expiresInPath))
    return { ok: true, accessToken: token, expiresAt: new Date(Date.now() + seconds * 1000) }
  } catch {
    return { ok: false, error: 'token_request_failed' }
  }
}
