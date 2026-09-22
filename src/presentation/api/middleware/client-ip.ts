/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { getConnInfo } from 'hono/bun'
import {
  hasUntrustedForwardingHeader,
  resolveClientIp,
  resolveTrustedForwardedIp,
} from '@/domain/kernel/url/client-ip'
import {
  parseTrustedProxyHops,
  TRUSTED_PROXY_HOPS_DEFAULT,
} from '@/domain/models/process-env/proxy'
import { logError, logWarning } from '@/infrastructure/logging/logger'
import type { Context } from 'hono'

/**
 * Request-scoped client-IP resolution for Hono.
 *
 * The security rule itself is pure and lives in `@/domain/utils/client-ip`;
 * this module is only the adapter that feeds it the two things that require a
 * live request — the headers and the transport peer — plus the operator's
 * declared hop count.
 *
 * It lives under `api/middleware/` because that is the one element type the
 * ESLint layer boundaries let all three families of caller reach: API routes,
 * other middleware, and the infrastructure server route-setup that wires them.
 * Every abuse control keys through here so a forged forwarding header cannot
 * buy a fresh bucket at one endpoint that it cannot buy at another.
 */

// eslint-disable-next-line functional/no-let -- one-shot module-level memo; decoding the env var per request would put an Effect Schema parse on the hot path of every abuse-controlled endpoint
let cachedHops: number | undefined

// eslint-disable-next-line functional/no-let -- one-shot latch so the misconfiguration warning is emitted once per process, not once per request
let warnedUntrustedHeader = false

/**
 * Hop count for this process, decoded once.
 *
 * A present-but-invalid `TRUSTED_PROXY_HOPS` throws out of the domain parser.
 * Here that is caught and degraded to the safe default rather than 500-ing
 * every request: refusing to serve is a worse outcome than keying strictly, and
 * the error is logged so the operator can see the cause.
 */
const trustedProxyHops = (): number => {
  if (cachedHops !== undefined) return cachedHops
  const resolved = ((): number => {
    try {
      return parseTrustedProxyHops()
    } catch (error) {
      logError(
        '[client-ip] TRUSTED_PROXY_HOPS is not a valid hop count — falling back to 0 (no forwarding header trusted)',
        error
      )
      return TRUSTED_PROXY_HOPS_DEFAULT
    }
  })()
  // eslint-disable-next-line functional/no-expression-statements -- module-level memo assignment
  cachedHops = resolved
  return resolved
}

/**
 * Warn once when a request arrives carrying a forwarding header that this
 * deployment is configured not to trust. Silence here is the failure mode we
 * are avoiding: an operator who put Caddy in front but never set
 * `TRUSTED_PROXY_HOPS` would see every visitor collapse into the proxy's own
 * bucket and have nothing in the logs pointing at the cause.
 */
const warnIfHeaderIgnored = (input: {
  readonly forwardedFor: string | undefined
  readonly realIp: string | undefined
  readonly cfConnectingIp: string | undefined
  readonly trustedProxyHops: number
}): void => {
  if (warnedUntrustedHeader) return
  if (!hasUntrustedForwardingHeader(input)) return
  // eslint-disable-next-line functional/no-expression-statements -- one-shot latch mutation
  warnedUntrustedHeader = true

  logWarning(
    '[client-ip] request carried a forwarding header (X-Forwarded-For / X-Real-IP / CF-Connecting-IP) but TRUSTED_PROXY_HOPS is unset, so it was ignored and rate limits are keyed on the connecting peer. If this app really sits behind a reverse proxy, set TRUSTED_PROXY_HOPS to the number of proxies in front of it (Caddy/nginx/Scalingo: 1; Cloudflare in front of Caddy: 2).'
  )
}

/**
 * Peer address of the underlying connection, or `undefined` when the adapter
 * cannot supply one.
 *
 * `getConnInfo` throws when `c.env` does not carry the Bun server (which is the
 * case under some test and SSG entrypoints) and can also return an empty
 * `remote`, so both are handled rather than trusted.
 */
const socketPeerOf = (c: Context): string | undefined => {
  try {
    return getConnInfo(c).remote.address
  } catch {
    return undefined
  }
}

/**
 * The address to key rate limits, spam guards and abuse counters on.
 *
 * Always returns a usable key — never `undefined` — so no caller can
 * accidentally skip a limiter because an address was missing.
 */
export const getRequestClientIp = (c: Context): string => {
  const forwardedFor = c.req.header('x-forwarded-for')
  const realIp = c.req.header('x-real-ip')
  const cfConnectingIp = c.req.header('cf-connecting-ip')
  const hops = trustedProxyHops()

  warnIfHeaderIgnored({ forwardedFor, realIp, cfConnectingIp, trustedProxyHops: hops })

  return resolveClientIp({
    forwardedFor,
    realIp,
    cfConnectingIp,
    socketPeer: socketPeerOf(c),
    trustedProxyHops: hops,
  })
}

/**
 * The address a trusted proxy vouched for, or `undefined` when none did.
 *
 * Deliberately does NOT fall back to the transport peer. Rate limiting wants an
 * address for every request; comparing a stored address against a live one only
 * makes sense when both were derived the same way. Handing the peer to such a
 * comparison silently turns "no information" into "different information".
 */
export const getRequestTrustedClientIp = (c: Context): string | undefined =>
  resolveTrustedForwardedIp({
    forwardedFor: c.req.header('x-forwarded-for'),
    realIp: c.req.header('x-real-ip'),
    cfConnectingIp: c.req.header('cf-connecting-ip'),
    trustedProxyHops: trustedProxyHops(),
  })
