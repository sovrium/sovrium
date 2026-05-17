/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { OAUTH_CALLBACK_TIMEOUT_MS } from '@/domain/utils/timeouts'
import { validateOutboundUrl } from '@/infrastructure/utils/validate-outbound-url'
import { withFetchTimeout } from '@/infrastructure/utils/with-fetch-timeout'

/**
 * OAuth2 refresh-token exchange (C-2).
 *
 * Builds on C-1's authorization-code flow: the same `tokenUrl`,
 * `clientId`, `clientSecret`, and `authenticationMethod` are used here,
 * but the body uses `grant_type=refresh_token` and forwards the stored
 * refresh token. New access (and optionally rotated refresh) tokens go
 * through the same `ConnectionTokenRepository.upsertForUser` path that
 * encrypts before write — so the encrypted-at-rest invariant from
 * APP-AUTOMATION-CONNECTION-066 holds for refreshed tokens as well.
 *
 * Concurrency: see `withRefreshLock` below — multiple in-flight refresh
 * requests for the same `(connectionId, userId)` key share a single
 * upstream call, so a flurry of concurrent automations can't overwhelm
 * the provider with duplicate refreshes (APP-AUTOMATION-CONNECTION-069).
 */

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

/**
 * Build the form-encoded body parameters sent to the token endpoint when
 * refreshing. Mirrors `buildTokenExchangeBody` in connections/index.ts
 * but uses the `refresh_token` grant. When `authenticationMethod === 'body'`
 * the client credentials go into the body; otherwise they're sent via
 * Basic auth header (built by `buildRefreshHeaders`). Returns an array
 * of `[key, value]` pairs to keep the function pure and its return type
 * immutable — the caller passes them to `URLSearchParams`, which
 * handles the mutable construction in one place.
 */
const buildRefreshBodyEntries = (
  props: OAuth2RefreshProps,
  refreshToken: string
): readonly (readonly [string, string])[] => {
  const baseEntries: readonly (readonly [string, string])[] = [
    ['grant_type', 'refresh_token'],
    ['refresh_token', refreshToken],
  ]
  // authenticationMethod controls where client_id/client_secret go.
  // 'header' (default per RFC 6749 §2.3.1) → Basic auth header set by
  //   `buildRefreshHeaders`; credentials are NOT placed in the form body.
  // 'body' → form-encoded `client_id`/`client_secret` params; no
  //   Authorization header.
  // The default is 'header' because RFC 6749 §2.3.1 prescribes HTTP
  // Basic for client authentication and stipulates that providers
  // SHOULD support it; APP-AUTOMATION-CONNECTION-080 asserts this
  // wire-level contract by sending no `authenticationMethod` and
  // expecting `Authorization: Basic` on the refresh request.
  const credentialEntries: readonly (readonly [string, string])[] =
    props.authenticationMethod === 'body'
      ? [
          ['client_id', props.clientId],
          ['client_secret', props.clientSecret],
        ]
      : []
  // Some providers require `scope` on refresh too (Auth0 narrows the
  // returned scopes if absent). Forward what was originally requested.
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
  // 'body' explicitly opts out of HTTP Basic — credentials go in the
  // form body instead. Anything else (including undefined / default)
  // sets the Authorization: Basic header per RFC 6749 §2.3.1.
  if (props.authenticationMethod === 'body') return base
  const credentials = Buffer.from(`${props.clientId}:${props.clientSecret}`, 'utf8').toString(
    'base64'
  )
  return { ...base, Authorization: `Basic ${credentials}` }
}

/**
 * Translate a successful provider response into the `RefreshResult` shape
 * specs assert on. Extracted so `refreshAccessToken` stays under the
 * complexity threshold.
 */
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

/**
 * Issue a refresh-token exchange against the provider. On success returns
 * the new access token (and optionally a rotated refresh token + expiry);
 * on failure returns a tagged error string the caller can surface as an
 * action failure or re-authorization prompt.
 *
 * Failure modes (covered by APP-AUTOMATION-CONNECTION-068):
 *   - `refresh_endpoint_4xx` — provider rejected the refresh token
 *     (revoked, expired, or invalid). Caller should mark the connection
 *     as needing re-authorization.
 *   - `refresh_endpoint_5xx` — transient provider failure; caller may
 *     retry or surface as an action failure.
 *   - `refresh_response_missing_access_token` — malformed provider
 *     response.
 *   - `refresh_request_failed` — network/timeout failure.
 */
export const refreshAccessToken = async (
  props: OAuth2RefreshProps,
  refreshToken: string
): Promise<RefreshResult> => {
  // SSRF guard: a misconfigured `tokenUrl` pointing at internal infra
  // would cause the refresh to leak the rotated token to the wrong host.
  // Reject loopback / link-local / RFC1918 / non-http(s) before the call.
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

/**
 * In-flight refresh dedup map (audit-equivalent of a redis lock for the
 * single-process case). Keyed on `(connectionId, userId)`. When a second
 * refresh request arrives while the first is mid-flight, both callers
 * await the same Promise — only one HTTP request hits the provider.
 *
 * The cached Promise covers the ENTIRE refresh-and-persist sequence —
 * not just the upstream HTTP call. Bundling persistence into the locked
 * unit closes the window where caller B's `findForUser` could race with
 * caller A's `upsertForUser` (and see the still-expired pre-refresh
 * token, triggering a redundant second refresh). The contract is now:
 * once the Promise resolves, the new tokens are durably persisted.
 *
 * Cleared automatically when the in-flight Promise settles (success OR
 * failure), so a transient failure doesn't poison subsequent attempts.
 *
 * Single-process scope: across multiple Sovrium replicas, two refreshes
 * could still race. Mitigated by the upsert's atomic
 * `(connection_id, user_id)` unique-index conflict resolution — the
 * second writer just overwrites with its (also-fresh) tokens.
 *
 * The cached Promise type is widened to `Promise<unknown>` because each
 * caller specializes the locked exec with its own result shape (some
 * pass just `RefreshResult`, others pass a richer post-persist
 * outcome). Internally `withRefreshLock` is generic over the exec
 * return type — see the function signature below.
 *
 * eslint-disable-next-line — this is a managed module-level cache, not
 * a leak. Effect's Ref<HashMap> would also work but adds DI plumbing
 * for a bounded internal cache.
 */
const inFlight = new Map<string, Promise<unknown>>()

const refreshKey = (input: { readonly connectionId: string; readonly userId: string }): string =>
  `${input.connectionId}::${input.userId}`

/**
 * Wrap a refresh-and-persist sequence with single-flight dedup. Multiple
 * concurrent calls for the same (connectionId, userId) coalesce into
 * one execution; all callers see the same final outcome — including
 * whatever post-persist state the caller chose to bundle into `exec`.
 *
 * The result type is generic so callers can return a richer outcome
 * (e.g. `{ ok: true, token: '<persisted-access-token>' }`) than the
 * raw upstream `RefreshResult`. Coalescing the entire refresh+persist
 * into a single locked unit is what makes
 * APP-AUTOMATION-CONNECTION-069 (and -083) actually one /token POST in
 * practice — the previous version locked only the upstream call,
 * leaving a window where caller B's `findForUser` could observe the
 * pre-refresh token in the database between A's response and A's
 * upsert and trigger a redundant second refresh.
 */
export const withRefreshLock = async <T>(
  input: { readonly connectionId: string; readonly userId: string },
  exec: () => Promise<T>
): Promise<T> => {
  const key = refreshKey(input)
  const pending = inFlight.get(key)
  if (pending !== undefined) return pending as Promise<T>
  const promise = exec().finally(() => {
    if (inFlight.get(key) === promise) {
      // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements, drizzle/enforce-delete-with-where -- managed module-level dedup cache; drizzle false positive (Map.delete not DB)
      inFlight.delete(key)
    }
  })
  // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- managed module-level dedup cache
  inFlight.set(key, promise)
  return promise
}
