/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { OAUTH_CALLBACK_TIMEOUT_MS } from '@/domain/utils/timeouts'
import { validateOutboundUrl } from '@/infrastructure/utils/validate-outbound-url'
import { withFetchTimeout } from '@/infrastructure/utils/with-fetch-timeout'


export interface OAuth2RefreshProps {
  readonly clientId: string
  readonly clientSecret: string
  readonly tokenUrl: string
  readonly scopes?: readonly string[]
  readonly audience?: string
  readonly extraTokenParams?: Readonly<Record<string, string>>
  readonly authenticationMethod?: 'header' | 'body'
}

export interface RefreshTokenResponse {
  readonly access_token?: string
  readonly refresh_token?: string
  readonly expires_in?: number
  readonly token_type?: string
}

export type RefreshResult =
  | {
      readonly ok: true
      readonly accessToken: string
      readonly refreshToken: string | undefined
      readonly expiresAt: Date | undefined
    }
  | { readonly ok: false; readonly error: string }

const buildRefreshBodyEntries = (
  props: OAuth2RefreshProps,
  refreshToken: string
): readonly (readonly [string, string])[] => {
  const baseEntries: readonly (readonly [string, string])[] = [
    ['grant_type', 'refresh_token'],
    ['refresh_token', refreshToken],
  ]
  const credentialEntries: readonly (readonly [string, string])[] =
    props.authenticationMethod === 'body'
      ? [
          ['client_id', props.clientId],
          ['client_secret', props.clientSecret],
        ]
      : []
  const scopeEntries: readonly (readonly [string, string])[] =
    props.scopes !== undefined && props.scopes.length > 0 ? [['scope', props.scopes.join(' ')]] : []
  const audienceEntries: readonly (readonly [string, string])[] =
    props.audience !== undefined && props.audience !== '' ? [['audience', props.audience]] : []
  const extraEntries: readonly (readonly [string, string])[] =
    props.extraTokenParams !== undefined
      ? Object.entries(props.extraTokenParams).map(([k, v]) => [k, v] as const)
      : []
  return [
    ...baseEntries,
    ...credentialEntries,
    ...scopeEntries,
    ...audienceEntries,
    ...extraEntries,
  ]
}

const buildRefreshHeaders = (props: OAuth2RefreshProps): Readonly<Record<string, string>> => {
  const base = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
  } as const
  if (props.authenticationMethod === 'body') return base
  const credentials = Buffer.from(`${props.clientId}:${props.clientSecret}`, 'utf8').toString(
    'base64'
  )
  return { ...base, Authorization: `Basic ${credentials}` }
}

const parseRefreshResponse = (tokens: RefreshTokenResponse): RefreshResult => {
  if (tokens.access_token === undefined || tokens.access_token === '') {
    return { ok: false, error: 'refresh_response_missing_access_token' }
  }
  const expiresAt =
    typeof tokens.expires_in === 'number'
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : undefined
  return {
    ok: true,
    accessToken: tokens.access_token,
    refreshToken:
      typeof tokens.refresh_token === 'string' && tokens.refresh_token !== ''
        ? tokens.refresh_token
        : undefined,
    expiresAt,
  }
}

export const refreshAccessToken = async (
  props: OAuth2RefreshProps,
  refreshToken: string
): Promise<RefreshResult> => {
  const validation = validateOutboundUrl(props.tokenUrl)
  if (!validation.ok) {
    return { ok: false, error: `refresh_invalid_url_${validation.issue.reason}` }
  }

  const body = new URLSearchParams(
    buildRefreshBodyEntries(props, refreshToken) as [string, string][]
  )
  const headers = buildRefreshHeaders(props)

  try {
    const response = await withFetchTimeout(
      props.tokenUrl,
      {
        method: 'POST',
        headers,
        body: body.toString(),
      },
      OAUTH_CALLBACK_TIMEOUT_MS
    )
    if (!response.ok) {
      const tag =
        response.status >= 400 && response.status < 500
          ? 'refresh_endpoint_4xx'
          : 'refresh_endpoint_5xx'
      return { ok: false, error: `${tag}_${String(response.status)}` }
    }
    const tokens = (await response.json()) as RefreshTokenResponse
    return parseRefreshResponse(tokens)
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'refresh_request_failed',
    }
  }
}

const inFlight = new Map<string, Promise<unknown>>()

const refreshKey = (input: { readonly connectionId: string; readonly userId: string }): string =>
  `${input.connectionId}::${input.userId}`

export const withRefreshLock = async <T>(
  input: { readonly connectionId: string; readonly userId: string },
  exec: () => Promise<T>
): Promise<T> => {
  const key = refreshKey(input)
  const pending = inFlight.get(key)
  if (pending !== undefined) return pending as Promise<T>
  const promise = exec().finally(() => {
    if (inFlight.get(key) === promise) {
      inFlight.delete(key)
    }
  })
  inFlight.set(key, promise)
  return promise
}
