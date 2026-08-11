/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Client-IP resolution — the single rule every rate limiter, spam guard and
 * abuse counter keys on.
 *
 * The whole point of this module is that an address a caller can choose is
 * worthless as a rate-limit key. Reverse proxies **append** to
 * `X-Forwarded-For`, so a header the client sent arrives as the LEFT of the
 * chain and whatever our own proxy observed arrives at the RIGHT. Reading from
 * the left therefore hands the caller a fresh bucket per request; reading from
 * the right, counted by the number of proxies the operator declared, is the
 * only part of the chain an attacker cannot write.
 *
 * Kept pure and dependency-free on purpose: it is reachable from the domain,
 * application, infrastructure and presentation layers alike, which is what lets
 * every call site share one rule instead of re-deriving it (six near-copies of
 * this logic existed before — auth, forms, comments, webhooks, analytics and the
 * session middleware — and every one of them read the forgeable end).
 */

/**
 * Last-resort key when neither a trusted header nor a transport peer is
 * available. A constant is correct here: an unkeyable request must land in
 * SOME bucket, and sharing one is safer than skipping the limiter.
 */
export const CLIENT_IP_FALLBACK = '127.0.0.1'

export interface ClientIpInput {
  /** Raw `X-Forwarded-For` header, if present. */
  readonly forwardedFor: string | undefined
  /** Raw `X-Real-IP` header (nginx / Caddy), if present. */
  readonly realIp: string | undefined
  /** Raw `CF-Connecting-IP` header (Cloudflare), if present. */
  readonly cfConnectingIp: string | undefined
  /** Peer address of the TCP connection, from the server adapter. */
  readonly socketPeer: string | undefined
  /** Number of reverse proxies the operator declared (`TRUSTED_PROXY_HOPS`). */
  readonly trustedProxyHops: number
}

/**
 * Split an `X-Forwarded-For` value into its hops, left (furthest / least
 * trustworthy) to right (nearest / written by our own infrastructure).
 * Blank entries are dropped so `"a, , b"` cannot shift the index.
 */
export const parseForwardedForChain = (header: string | undefined): readonly string[] =>
  header === undefined
    ? []
    : header
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry !== '')

const presentOrUndefined = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim()
  return trimmed === undefined || trimmed === '' ? undefined : trimmed
}

/**
 * The address a forwarding header may be believed to carry, or `undefined` when
 * none may be.
 *
 * - `trustedProxyHops === 0` — no proxy is declared, so NO forwarding header is
 *   believed at all. This is the zero-config default.
 * - `trustedProxyHops >= 1` — a proxy is declared. Single-valued headers set by
 *   the nearest proxy (`CF-Connecting-IP`, then `X-Real-IP`) win, because a
 *   client cannot append to them the way it can to a list. Otherwise the
 *   forwarding chain is read right-to-left at `chain[length - hops]`.
 *
 * A chain shorter than the declared hop count yields `undefined`: the request
 * did not arrive through the expected proxies (misconfiguration, or a caller
 * sending its own header straight to a direct-bound port), so there is nothing
 * here worth trusting and the caller decides what to do instead.
 *
 * Exposed separately from {@link resolveClientIp} for the callers that must
 * distinguish "a proxy vouched for this address" from "this is merely who
 * connected" — see the session-binding note in the auth middleware.
 */
export const resolveTrustedForwardedIp = (input: {
  readonly forwardedFor: string | undefined
  readonly realIp: string | undefined
  readonly cfConnectingIp: string | undefined
  readonly trustedProxyHops: number
}): string | undefined => {
  if (input.trustedProxyHops <= 0) return undefined

  const cloudflare = presentOrUndefined(input.cfConnectingIp)
  if (cloudflare !== undefined) return cloudflare

  const realIp = presentOrUndefined(input.realIp)
  if (realIp !== undefined) return realIp

  const chain = parseForwardedForChain(input.forwardedFor)
  return chain[chain.length - input.trustedProxyHops]
}

/**
 * Resolve the address to key abuse controls on.
 *
 * A trusted forwarding header if one exists, otherwise the transport peer,
 * otherwise the constant fallback. Always yields a usable key so a limiter can
 * never be skipped for want of an address.
 */
export const resolveClientIp = (input: ClientIpInput): string =>
  resolveTrustedForwardedIp(input) ?? presentOrUndefined(input.socketPeer) ?? CLIENT_IP_FALLBACK

/**
 * True when the caller presented a forwarding header that this deployment is
 * configured to ignore. Used to warn an operator once per process: silently
 * dropping the header would leave a genuinely proxied install keying every
 * client to the same proxy address with no clue why.
 */
export const hasUntrustedForwardingHeader = (input: {
  readonly forwardedFor: string | undefined
  readonly realIp: string | undefined
  readonly cfConnectingIp: string | undefined
  readonly trustedProxyHops: number
}): boolean =>
  input.trustedProxyHops <= 0 &&
  (presentOrUndefined(input.forwardedFor) !== undefined ||
    presentOrUndefined(input.realIp) !== undefined ||
    presentOrUndefined(input.cfConnectingIp) !== undefined)
