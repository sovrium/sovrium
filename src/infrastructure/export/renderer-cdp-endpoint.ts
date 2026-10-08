/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { redactConnectionUrl } from '@/domain/kernel/sanitize/redact-connection-url'
import { withFetchTimeout } from '@/infrastructure/egress/with-fetch-timeout'

/**
 * Turn `RENDERER_CDP_URL` into the DevTools WebSocket address of a running
 * Chrome ([internal ref] D2, sidecar discovery).
 *
 * Chrome refuses any HTTP or WebSocket request whose `Host` header is neither
 * an IP address nor `localhost` (measured: `500 Host header is specified and is
 * not an IP address or localhost`, WebSocket close 1002). A compose service
 * name such as `http://renderer:9222` therefore only works once its hostname
 * is resolved to an address, which is done here, BEFORE discovery and before
 * the connection.
 *
 * The sidecar is operator-configured and private by design, so this request
 * deliberately does not go through the outbound-address guard; it is bounded by
 * `withFetchTimeout` like every network egress.
 */

/** Resolves a hostname to one address. Injected so the step is testable offline. */
export type HostResolver = (hostname: string) => Promise<string>

const defaultResolver: HostResolver = async (hostname) => (await lookup(hostname)).address

const isAddressLike = (hostname: string): boolean =>
  hostname === 'localhost' || isIP(hostname.replace(/^\[|\]$/g, '')) !== 0

/** An address as a URL host: an IPv6 literal goes in brackets. */
const asUrlHost = (address: string): string => (isIP(address) === 6 ? `[${address}]` : address)

/**
 * `url` with its hostname replaced by the address it resolves to; an IP or
 * `localhost` is left as written, and so is any TLS address (`wss:`,
 * `https:`): the certificate is checked against the NAME, so swapping it for
 * an IP would fail the handshake, and a TLS endpoint sits behind a proxy that
 * routes by name anyway.
 */
export const resolveUrlHost = async (url: URL, resolve: HostResolver): Promise<URL> => {
  if (url.protocol === 'wss:' || url.protocol === 'https:') return url
  if (isAddressLike(url.hostname)) return url
  const resolved = new URL(url.href)
  resolved.hostname = asUrlHost(await resolve(url.hostname))
  return resolved
}

/** Fetches Chrome's `/json/version`; injected for tests. */
export type VersionFetcher = (url: string) => Promise<unknown>

const defaultVersionFetcher =
  (timeoutMs: number): VersionFetcher =>
  async (url) => {
    const response = await withFetchTimeout(url, { method: 'GET' }, timeoutMs)
    if (!response.ok) throw new Error(`DevTools discovery answered ${String(response.status)}`)
    return response.json()
  }

const debuggerUrlOf = (version: unknown): string | undefined => {
  if (typeof version !== 'object' || version === null) return undefined
  const value = (version as { readonly webSocketDebuggerUrl?: unknown }).webSocketDebuggerUrl
  return typeof value === 'string' ? value : undefined
}

export interface CdpEndpointDeps {
  readonly resolve?: HostResolver
  readonly fetchVersion?: VersionFetcher
  readonly timeoutMs: number
}

/**
 * The `ws://` address to connect to. A `ws(s)://` value is used as given once
 * its host is resolved; an `http(s)://` value is discovered through
 * `/json/version`, whose answer is then pointed back at the resolved address
 * (Chrome builds it from the `Host` it was asked on, which a proxy may change).
 */
export const resolveCdpWebSocketUrl = async (
  cdpUrl: string,
  deps: CdpEndpointDeps
): Promise<string> => {
  const resolve = deps.resolve ?? defaultResolver
  const target = await resolveUrlHost(new URL(cdpUrl), resolve)
  if (target.protocol === 'ws:' || target.protocol === 'wss:') return target.href
  const discovery = new URL('/json/version', target)
  const fetchVersion = deps.fetchVersion ?? defaultVersionFetcher(deps.timeoutMs)
  const debuggerUrl = debuggerUrlOf(await fetchVersion(discovery.href))
  if (debuggerUrl === undefined) {
    throw new Error(`${redactConnectionUrl(discovery.href)} did not name a webSocketDebuggerUrl`)
  }
  const socket = new URL(debuggerUrl)
  socket.protocol = target.protocol === 'https:' ? 'wss:' : 'ws:'
  // Host AND port, separately: assigning `host` without a port keeps Chrome's
  // own 9222, so a proxy on the default port would be dialled on the wrong one.
  socket.hostname = target.hostname
  socket.port = target.port
  return socket.href
}
