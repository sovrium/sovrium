/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The one way an outbound request whose target a user or an operator chose
 * leaves the process.
 *
 * ## Why this exists
 *
 * Every such caller validated the FIRST URL with `validateOutboundUrl` and then
 * handed it to `fetch`, which followed up to twenty redirects with no guard in
 * front of any of them, and read the answer whole before any size cap applied.
 * So a host the guard accepted could answer `302 Location: http://127.0.0.1/…`
 * and the request — its headers, its body, a connection's token — went there;
 * and an answer that never ended held the run open for as long as it kept
 * sending. Eight callers had drifted into that shape one by one, so the fix is
 * one primitive rather than eight patches.
 *
 * ## What it does, in order
 *
 * 1. Validates the URL (`validateOutboundUrl`).
 * 2. Sends it with `redirect: 'manual'` under `withFetchTimeout`.
 * 3. On a 3xx carrying a `Location`, resolves it against the URL that answered,
 *    validates THAT, and sends again — at most {@link MAX_REDIRECT_HOPS} times.
 *    The method and body change the way `fetch` would change them (303, and a
 *    301/302 to a POST, become a body-less GET), and a hop to another origin
 *    drops the credentials headers, as `fetch` does.
 * 4. Reads the final body up to `maxBodyBytes`, then cancels the stream and
 *    reports `truncated: true` — the rest is never downloaded.
 *
 * ## What it does NOT do
 *
 * The https-only rule `follow-redirects.ts` applies to hops is not carried over.
 * It belongs to fetching a configuration, where the document becomes the app; an
 * http action the operator pointed at `http://` may be redirected over `http://`.
 *
 * Hostnames are not resolved: a name that resolves to a private address passes,
 * here as on the first URL. Closing that needs resolve-then-connect-to-the-
 * checked-address, which `fetch` cannot express.
 *
 * ## Errors
 *
 * A refused URL or hop is a RESULT (`ok: false`), whose `message` starts with
 * `invalid_outbound_url_<reason>` like every caller's first-URL refusal. A
 * rejected promise is a transport failure — DNS, TLS, the deadline — and stays
 * the caller's to map, exactly as it was for `withFetchTimeout`.
 */

import {
  discardBody,
  MAX_REDIRECT_HOPS,
  REDIRECT_STATUSES,
} from '@/infrastructure/egress/follow-redirects'
import {
  validateOutboundUrl,
  type OutboundUrlReason,
} from '@/infrastructure/egress/validate-outbound-url'
import { withFetchTimeout } from '@/infrastructure/egress/with-fetch-timeout'

/** The deadline and the body cap of one guarded request. @public */
export interface GuardedFetchOptions {
  /** Bounds each hop's wait for headers, then the read of the final body. */
  readonly timeoutMs: number
  /** Bytes of the final body kept; `0` reads none and only cancels the stream. */
  readonly maxBodyBytes: number
  /**
   * More headers that carry a credential — an API key under a name only the
   * caller knows — dropped, like `Authorization`, on a hop to another origin.
   */
  readonly credentialHeaders?: readonly string[]
}

/** The final answer, its body already read up to the cap. @public */
export interface GuardedResponse {
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

/** Why a request was not sent. @public */
export type GuardedFetchRefusalReason = OutboundUrlReason | 'too-many-redirects'

/** @public */
export type GuardedFetchResult =
  | { readonly ok: true; readonly response: GuardedResponse }
  | {
      readonly ok: false
      readonly reason: GuardedFetchRefusalReason
      /** `invalid_outbound_url_<reason>`, plus where a redirect pointed. */
      readonly message: string
    }

/**
 * The cap on a token endpoint's answer, in bytes: an access token, a refresh
 * token and a few fields fit in a few KiB, so one MiB is generous and still
 * bounded. @public
 */
export const TOKEN_RESPONSE_MAX_BYTES = 1_048_576

/** Headers that describe a body, dropped when a redirect drops the body. */
const BODY_HEADERS: readonly string[] = [
  'content-type',
  'content-length',
  'content-encoding',
  'content-language',
  'content-location',
]

/** Headers that carry credentials, dropped on a hop to another origin. */
const CREDENTIAL_HEADERS: readonly string[] = ['authorization', 'proxy-authorization', 'cookie']

type RequestShape = Readonly<Omit<RequestInit, 'signal' | 'redirect'>>

/** Drop the credential headers, the caller's own included, before a hop to another origin. */
const dropCredentials = (headers: Headers, callerNamed: readonly string[] = []): void =>
  [...CREDENTIAL_HEADERS, ...callerNamed].forEach((name) => headers.delete(name))

/** The request a redirect leads to, per the fetch standard's method rewrite. */
const nextRequest = (
  status: number,
  hop: { readonly from: URL; readonly to: URL },
  init: RequestShape,
  credentialHeaders: readonly string[] | undefined
): RequestShape => {
  const method = (init.method ?? 'GET').toUpperCase()
  const dropsBody =
    (status === 303 && method !== 'GET' && method !== 'HEAD') ||
    ((status === 301 || status === 302) && method === 'POST')
  const headers = new Headers(init.headers)
  if (dropsBody) BODY_HEADERS.forEach((name) => headers.delete(name))
  if (hop.from.origin !== hop.to.origin) dropCredentials(headers, credentialHeaders)
  if (!dropsBody) return { ...init, headers }
  const { body: _dropped, ...rest } = init
  return { ...rest, method: 'GET', headers }
}

const refusal = (reason: GuardedFetchRefusalReason, detail?: string): GuardedFetchResult => ({
  ok: false,
  reason,
  message: `invalid_outbound_url_${reason}${detail === undefined ? '' : ` (${detail})`}`,
})

/**
 * Read at most `maxBytes` of a body, then cancel the stream.
 *
 * The read is bounded by `timeoutMs` as a whole: a peer that sends its headers
 * and then stops talking is abandoned rather than waited on.
 */
const readCapped = async (
  response: Response,
  maxBytes: number,
  timeoutMs: number
): Promise<{ readonly body: Uint8Array; readonly truncated: boolean }> => {
  if (response.body === null) return { body: new Uint8Array(0), truncated: false }
  if (maxBytes <= 0) {
    await discardBody(response)
    return { body: new Uint8Array(0), truncated: false }
  }
  const reader = response.body.getReader()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    // Cancelling settles the pending read; the flag turns it into a rejection below.
    void reader.cancel().catch(() => undefined)
  }, timeoutMs)
  let chunks: readonly Uint8Array[] = []
  let total = 0
  try {
    while (total <= maxBytes) {
      const { done, value } = await reader.read()
      if (timedOut) throw new DOMException('The response body timed out', 'TimeoutError')
      if (done) return { body: concat(chunks, total, total), truncated: false }
      chunks = [...chunks, value]
      total += value.byteLength
    }
    await reader.cancel().catch(() => undefined)
    return { body: concat(chunks, total, maxBytes), truncated: true }
  } finally {
    clearTimeout(timer)
  }
}

const concat = (chunks: readonly Uint8Array[], total: number, keep: number): Uint8Array => {
  const out = new Uint8Array(total)
  chunks.reduce((offset, chunk) => {
    out.set(chunk, offset)
    return offset + chunk.byteLength
  }, 0)
  return keep < total ? out.slice(0, keep) : out
}

/** One request, then either the answer or the next decision. */
const requestHop = async (
  url: URL,
  init: RequestShape,
  options: GuardedFetchOptions,
  hopsLeft: number
): Promise<GuardedFetchResult> => {
  const response = await withFetchTimeout(url, { ...init, redirect: 'manual' }, options.timeoutMs)
  const location = REDIRECT_STATUSES.has(response.status) ? response.headers.get('location') : null
  // A 3xx without a Location has nowhere to go: like `fetch`, hand it back as the answer.
  if (location === null || location === '') {
    const { body, truncated } = await readCapped(response, options.maxBodyBytes, options.timeoutMs)
    return {
      ok: true,
      response: {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: response.headers,
        url: url.href,
        body,
        truncated,
      },
    }
  }
  await discardBody(response)
  if (hopsLeft === 0) return refusal('too-many-redirects', `more than ${MAX_REDIRECT_HOPS}`)
  const next = URL.parse(location, url.href)
  const validation = validateOutboundUrl(next?.href ?? location)
  if (!validation.ok) return refusal(validation.issue.reason, 'redirect')
  return requestHop(
    validation.url,
    nextRequest(
      response.status,
      { from: url, to: validation.url },
      init,
      options.credentialHeaders
    ),
    options,
    hopsLeft - 1
  )
}

/**
 * Send `init` to `url` with the outbound-address guard on the URL and on every
 * redirect hop, and read the answer up to `maxBodyBytes`.
 *
 * @public
 */
export const guardedFetch = async (
  url: string | URL,
  init: RequestShape,
  options: GuardedFetchOptions
): Promise<GuardedFetchResult> => {
  const validation = validateOutboundUrl(typeof url === 'string' ? url : url.href)
  if (!validation.ok) return refusal(validation.issue.reason)
  return requestHop(validation.url, init, options, MAX_REDIRECT_HOPS)
}

/** The body as UTF-8 text; a multi-byte character cut by the cap becomes U+FFFD. @public */
export const guardedText = (response: GuardedResponse): string =>
  new TextDecoder().decode(response.body)
