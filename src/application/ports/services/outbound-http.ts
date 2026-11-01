/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data, type Effect } from 'effect'

/**
 * The outbound requests a use-case sends to an address a user or an operator
 * chose — an `http/*` or `webhook/*` step, a connection operation, a calendar
 * feed, a file source, the GIF provider and its pictures.
 *
 * The application layer may not open a socket, so it asks this port. Its one
 * adapter (`infrastructure/egress/outbound-http-live.ts`) is the guarded
 * egress itself: the URL and every redirect hop judged by the outbound-address
 * guard, every hop's host name resolved and the request sent to the address
 * that was checked, a deadline on each hop and on the body read, and the body
 * read no further than its cap. Nothing about that guard is configurable from
 * here — there is deliberately no way to opt out of host resolution through
 * the port.
 *
 * Provided by the automation runtime layer, which the server runtime merges;
 * a unit test provides a fake with `Effect.provideService`.
 */

/** Why a request was not sent: the guard refused the URL or a redirect hop. */
export type OutboundRefusalReason =
  | 'invalid-url'
  | 'unsupported-protocol'
  | 'private-host'
  | 'localhost'
  | 'link-local'
  | 'too-many-redirects'
  | 'cross-origin-redirect'

/** The request itself: everything `fetch` takes but the signal and the redirect mode. */
export type OutboundRequestInit = Readonly<Omit<RequestInit, 'signal' | 'redirect'>>

/** The deadline and the body cap of one request. */
export interface OutboundRequestOptions {
  /** Bounds each hop's wait for headers, then the read of the final body. */
  readonly timeoutMs: number
  /** Bytes of the final body kept; `0` reads none and only cancels the stream. */
  readonly maxBodyBytes: number
  /**
   * More headers that carry a credential — an API key under a name only the
   * caller knows — dropped, like `Authorization`, on a hop to another origin.
   */
  readonly credentialHeaders?: readonly string[]
  /**
   * The body itself carries a secret (a client secret, a refresh token). A
   * redirect that would re-send it to another origin is refused, not followed.
   */
  readonly bodyCarriesSecret?: boolean
}

/** The final answer, its body already read up to the cap. */
export interface OutboundResponse {
  readonly status: number
  readonly statusText: string
  readonly ok: boolean
  readonly headers: Headers
  /** The URL that answered, after any redirects. */
  readonly url: string
  readonly body: Uint8Array
  /** True when the body went past `maxBodyBytes` and the rest was not read. */
  readonly truncated: boolean
}

/** A sent request's answer, or the guard's refusal (nothing was sent). */
export type OutboundFetchResult =
  | { readonly ok: true; readonly response: OutboundResponse }
  | {
      readonly ok: false
      readonly reason: OutboundRefusalReason
      /** `invalid_outbound_url_<reason>`, plus where a redirect pointed. */
      readonly message: string
    }

/** A picture as the app serves it. */
export interface OutboundImage {
  readonly bytes: Uint8Array
  readonly contentType: string
}

/** A picture read: the picture, or why there is none. */
export type OutboundImageResult =
  | { readonly ok: true; readonly image: OutboundImage }
  | { readonly ok: false; readonly reason: string }

/** How one picture address is read and how long its answer is kept. */
export interface OutboundImageOptions {
  readonly maxBytes: number
  readonly timeoutMs: number
  /** How long a picture is reused, in milliseconds. */
  readonly ttlMs: number
  /** How long a refusal or a failure is remembered, in milliseconds. */
  readonly failureTtlMs: number
}

/**
 * Sent and unanswered: DNS, TLS, a refused or reset connection, the deadline.
 * `cause` is the transport's own error, untouched, so a caller that classifies
 * it (`error.code`, a `TimeoutError`) reads exactly what it read before.
 */
export class OutboundTransportError extends Data.TaggedError('OutboundTransportError')<{
  readonly cause: unknown
}> {}

export class OutboundHttp extends Context.Service<
  OutboundHttp,
  {
    /**
     * Send `init` to `url` with the outbound-address guard on the URL and on
     * every redirect hop, and read the answer up to `maxBodyBytes`. A refusal
     * is a RESULT (`ok: false`); only a transport failure fails the Effect.
     */
    readonly guardedFetch: (
      url: string | URL,
      init: OutboundRequestInit,
      options: OutboundRequestOptions
    ) => Effect.Effect<OutboundFetchResult, OutboundTransportError>
    /**
     * The raster picture at `address`, read once through the same guard and
     * kept for `ttlMs` (a refusal for `failureTtlMs`); SVG and any type that
     * is not a browser-drawn raster is refused. Never fails: a refusal or a
     * transport failure is `{ ok: false, reason }`.
     */
    readonly fetchRemoteImage: (
      address: string,
      options: OutboundImageOptions
    ) => Effect.Effect<OutboundImageResult>
  }
>()('sovrium/OutboundHttp') {}

/** The body as UTF-8 text; a multi-byte character cut by the cap becomes U+FFFD. */
export const outboundText = (response: OutboundResponse): string =>
  new TextDecoder().decode(response.body)
