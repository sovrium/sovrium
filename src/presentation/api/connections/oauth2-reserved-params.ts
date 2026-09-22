/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Reserved standard OAuth2 parameter names that `extraAuthParams` and
 * `extraTokenParams` cannot override. These are owned by the framework —
 * silently letting an admin override `client_id`, `response_type`,
 * `grant_type`, etc. via "extra" params would be a security hazard
 * (e.g. swapping `grant_type` from `authorization_code` to `password`
 * would break the entire flow).
 *
 * Used by buildAuthorizeUrl / buildTokenExchangeBody in connections/index.ts
 * (specs).
 */
export const RESERVED_AUTH_PARAMS: ReadonlySet<string> = new Set([
  'client_id',
  'response_type',
  'redirect_uri',
  'scope',
  'state',
  'code_challenge',
  'code_challenge_method',
  'audience',
])

export const RESERVED_TOKEN_PARAMS: ReadonlySet<string> = new Set([
  'grant_type',
  'code',
  'redirect_uri',
  'client_id',
  'client_secret',
  'code_verifier',
  'audience',
])

/**
 * Apply a `Record<string, string>` of extra params to a `URLSearchParams`,
 * dropping any keys present in `reserved`. Used for both authorize-URL
 * query params and token-exchange body params.
 */
export const applyExtraParamsExcludingReserved = (
  target: URLSearchParams,
  extras: Readonly<Record<string, string>> | undefined,
  reserved: ReadonlySet<string>
): void => {
  if (extras === undefined) return
  Object.entries(extras).forEach(([key, value]) => {
    if (!reserved.has(key)) {
      target.set(key, value)
    }
  })
}
