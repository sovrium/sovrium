/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { getConnInfo } from 'hono/bun'
import { parseTrustedProxyHops, TRUSTED_PROXY_HOPS_DEFAULT } from '@/domain/models/env/proxy'
import {
  hasUntrustedForwardingHeader,
  resolveClientIp,
  resolveTrustedForwardedIp,
} from '@/domain/utils/client-ip'
import { logError, logWarning } from '@/infrastructure/logging/logger'
import type { Context } from 'hono'


let cachedHops: number | undefined

let warnedUntrustedHeader = false

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
  cachedHops = resolved
  return resolved
}

const warnIfHeaderIgnored = (input: {
  readonly forwardedFor: string | undefined
  readonly realIp: string | undefined
  readonly cfConnectingIp: string | undefined
  readonly trustedProxyHops: number
}): void => {
  if (warnedUntrustedHeader) return
  if (!hasUntrustedForwardingHeader(input)) return
  warnedUntrustedHeader = true

  logWarning(
    '[client-ip] request carried a forwarding header (X-Forwarded-For / X-Real-IP / CF-Connecting-IP) but TRUSTED_PROXY_HOPS is unset, so it was ignored and rate limits are keyed on the connecting peer. If this app really sits behind a reverse proxy, set TRUSTED_PROXY_HOPS to the number of proxies in front of it (Caddy/nginx/Scalingo: 1; Cloudflare in front of Caddy: 2).'
  )
}

const socketPeerOf = (c: Context): string | undefined => {
  try {
    return getConnInfo(c).remote.address
  } catch {
    return undefined
  }
}

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

export const getRequestTrustedClientIp = (c: Context): string | undefined =>
  resolveTrustedForwardedIp({
    forwardedFor: c.req.header('x-forwarded-for'),
    realIp: c.req.header('x-real-ip'),
    cfConnectingIp: c.req.header('cf-connecting-ip'),
    trustedProxyHops: trustedProxyHops(),
  })
