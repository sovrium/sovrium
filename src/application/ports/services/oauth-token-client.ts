/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The token-endpoint conversations a connection has with its provider, as the
 * automation steps that authenticate outgoing requests see them.
 *
 * Every request is SSRF-guarded and bounded by the implementation, and every
 * provider refusal is a RESULT (`{ ok: false, error }`), never a failure: the
 * failure channel carries only a transport defect the implementation could not
 * turn into a result. {@link OAuthTokenClient.withRefreshLock} is the
 * process-local single-flight that keeps a flurry of concurrent steps from
 * refreshing the same `(connectionId, userId)` twice.
 */

import { Context, Data, type Effect } from 'effect'

/** The token request could not be made at all. `cause` is never logged — it can quote a secret-bearing URL. */
export class OAuthTokenTransportError extends Data.TaggedError('OAuthTokenTransportError')<{
  readonly cause: unknown
}> {}

export interface OAuth2RefreshProps {
  readonly clientId: string
  readonly clientSecret: string
  readonly tokenUrl: string
  readonly scopes?: readonly string[]
  readonly audience?: string
  readonly extraTokenParams?: Readonly<Record<string, string>>
  readonly authenticationMethod?: 'header' | 'body'
  /**
   * Extra fields of the token response the connection keeps (`tokenFields`),
   * e.g. Salesforce's `instance_url`. Captured as strings beside the token.
   */
  readonly keepFields?: readonly string[]
}

export type RefreshResult =
  | {
      readonly ok: true
      readonly accessToken: string
      readonly refreshToken: string | undefined
      readonly expiresAt: Date | undefined
      /** The kept response fields present in the answer (see `keepFields`). */
      readonly fields?: Readonly<Record<string, string>>
    }
  | { readonly ok: false; readonly error: string }

/** The client and endpoint a long-lived token exchange is made with. */
export interface LongLivedExchangeProps {
  readonly clientId: string
  readonly clientSecret: string
  readonly tokenUrl: string
}

/** A resolved token exchange request: every `$env.VAR` already substituted. */
export interface TokenExchangeRequest {
  readonly tokenUrl: string
  readonly body: Readonly<Record<string, string>>
  readonly bodyType: 'json' | 'form'
  readonly tokenPath: string
  readonly expiresInPath: string
}

export type TokenExchangeResult =
  | { readonly ok: true; readonly accessToken: string; readonly expiresAt: Date }
  | { readonly ok: false; readonly error: string }

export class OAuthTokenClient extends Context.Service<
  OAuthTokenClient,
  {
    /** The `refresh_token` grant. */
    readonly refreshAccessToken: (
      props: Readonly<OAuth2RefreshProps>,
      refreshToken: string
    ) => Effect.Effect<RefreshResult, OAuthTokenTransportError>
    /** The `client_credentials` grant. */
    readonly requestClientCredentialsToken: (
      props: Readonly<OAuth2RefreshProps>
    ) => Effect.Effect<RefreshResult, OAuthTokenTransportError>
    /** Meta's `fb_exchange_token` long-lived exchange. */
    readonly exchangeLongLivedToken: (
      props: Readonly<LongLivedExchangeProps>,
      currentToken: string
    ) => Effect.Effect<RefreshResult, OAuthTokenTransportError>
    /** A configured token-exchange request. */
    readonly requestExchangedToken: (
      request: Readonly<TokenExchangeRequest>
    ) => Effect.Effect<TokenExchangeResult, OAuthTokenTransportError>
    /**
     * Run `program` under the single-flight lock for one connection and user,
     * on the services the calling fiber already holds. A rejection of the lock
     * itself becomes `onRejection(cause)`.
     */
    readonly withRefreshLock: <A, E, R>(
      input: { readonly connectionId: string; readonly userId: string | undefined },
      program: Effect.Effect<A, never, R>,
      onRejection: (cause: unknown) => E
    ) => Effect.Effect<A, E, R>
  }
>()('OAuthTokenClient') {}
