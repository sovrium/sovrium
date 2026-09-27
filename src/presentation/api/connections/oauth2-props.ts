/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveRequestBaseUrl } from '@/domain/kernel/url/request-base-url'
import { withProviderEndpoints } from '@/domain/models/app/connections/oauth2-provider-validation'
import { connectionError } from './error-envelopes'
import type { Context } from 'hono'

/**
 * OAuth2 connection props — runtime view.
 *
 * NOTE on schema/runtime drift (REC-3):
 *   The Effect Schema (`src/domain/models/app/connections/props.ts`)
 *   declares `authorizationUrl`, `tokenUrl`, and `redirectUri` as
 *   `Schema.optional` because the `clientCredentials` grant type only
 *   needs `tokenUrl` (see `client-credentials.spec.ts`). The schema is
 *   correct — these fields are conditionally required based on
 *   `grantType`. This interface was previously declared with all three
 *   fields as required-strings, which is wrong for the
 *   `clientCredentials` path (works only because that path doesn't
 *   touch the authorize/callback handlers).
 *
 *   Marking them optional here matches the schema; the authorize/callback
 *   handlers then validate presence at use site (see
 *   `requireAuthCodeFields`) and surface a clear `connection_misconfigured`
 *   error rather than crashing on `new URL(undefined)`.
 *
 *   Future option-(a) migration (make required at the schema level for
 *   `grantType: 'authorizationCode'` only via cross-field validation) is
 *   deferred — it would require coordinated changes across
 *   `OAuth2PropsSchema`, `client-credentials.spec.ts`, and the schema
 *   test fixtures.
 */
export interface OAuth2Props {
  /** Known-provider shorthand: fills the endpoints the config leaves out. */
  readonly provider?: string
  readonly clientId: string
  readonly clientSecret: string
  readonly authorizationUrl?: string
  readonly tokenUrl?: string
  readonly scopes?: readonly string[]
  readonly redirectUri?: string
  readonly grantType?: string
  readonly pkce?: 'S256' | 'plain' | 'none'
  readonly audience?: string
  readonly extraAuthParams?: Readonly<Record<string, string>>
  readonly extraTokenParams?: Readonly<Record<string, string>>
  /**
   * Connection scope:
   *   - 'app'  → admin-only authorize, single shared token row
   *   - 'user' → any authenticated user authorizes, per-user token row
   * Default: 'app' (preserves backwards-compat with pre-scope specs).
   */
  readonly scope?: 'app' | 'user'
  readonly authenticationMethod?: 'header' | 'body'
  /** Token-response fields kept beside the token (e.g. `instance_url`). */
  readonly tokenFields?: readonly string[]
  /** Exchange the code's short-lived token for a long-lived one (Meta). */
  readonly longLivedToken?: { readonly style: 'meta'; readonly renewWithinDays?: number }
}

/**
 * Runtime-shape view after `requireAuthCodeFields` confirms the three
 * authorization-code fields are present. Used by helpers downstream that
 * need to call `new URL()` on these values without further checks.
 */
export interface OAuth2AuthCodeProps extends OAuth2Props {
  readonly authorizationUrl: string
  readonly tokenUrl: string
  readonly redirectUri: string
}

const isMissingString = (value: string | undefined): boolean => value === undefined || value === ''

/**
 * Fill what the config may leave out: the endpoints of a known `provider`, and
 * `redirectUri`, which defaults to this app's own callback — `<base URL><callbackPath>`,
 * the base URL being `BASE_URL` when set, otherwise the request's own origin.
 * Applied identically at the authorize step and at the callback, because the
 * provider refuses a code exchange whose `redirect_uri` differs from the one
 * the user was sent with. Explicit values always win.
 */
const withAuthCodeDefaults = (
  c: Context,
  props: OAuth2Props,
  callbackPath: string
): OAuth2Props => {
  const withEndpoints = withProviderEndpoints(props)
  return isMissingString(withEndpoints.redirectUri)
    ? { ...withEndpoints, redirectUri: `${resolveRequestBaseUrl(c)}${callbackPath}` }
    : withEndpoints
}

/**
 * Validate that the props required for the authorization-code grant flow
 * are all present. The schema marks them optional (see OAuth2Props
 * docstring) because `clientCredentials` only needs `tokenUrl`; this
 * helper bridges that ambiguity at the route handler so the rest of the
 * authorize/callback path can treat them as required.
 *
 * Returns `{ response }` when one or more fields are missing (caller
 * should return verbatim) or `{ props }` when all three are valid.
 */
export const requireAuthCodeFields = (
  c: Context,
  declared: OAuth2Props,
  callbackPath: string
): { readonly response: Response } | { readonly props: OAuth2AuthCodeProps } => {
  const props = withAuthCodeDefaults(c, declared, callbackPath)
  const missing: readonly string[] = (
    [
      ['authorizationUrl', props.authorizationUrl],
      ['tokenUrl', props.tokenUrl],
      ['redirectUri', props.redirectUri],
    ] as const
  )
    .filter(([, value]) => isMissingString(value))
    .map(([name]) => name)
  if (missing.length > 0) {
    return {
      response: connectionError(c, 500, 'connection_misconfigured', {
        message: `OAuth2 authorization-code flow requires: ${missing.join(', ')}`,
      }),
    }
  }
  return { props: props as OAuth2AuthCodeProps }
}
