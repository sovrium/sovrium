/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The outbound guard, read through the resolver — and the request sent to the
 * address it checked.
 *
 * `validateOutboundUrl` judges a host by how it is SPELLED: a private or
 * loopback literal, `localhost`, a link-local address. A public-looking NAME
 * passes it whatever it points at, so `intranet.example.com → 10.0.0.5` would
 * be fetched. This module asks the resolver what a name points at, refuses the
 * name when ANY of its addresses is one the guard refuses as a literal, and
 * otherwise PINS the request to the first address it checked: the connection
 * goes to that address, with the name kept as the `Host` header and as the TLS
 * server name (which is also the name the certificate is verified against). A
 * name that answers a public address to the check and a private one a moment
 * later to the connection therefore reaches nothing: the second answer is
 * never asked for.
 *
 * A name the resolver cannot answer is refused — the guard sends nowhere it
 * did not vet — unless the request leaves through an outbound proxy
 * (`http_proxy` / `https_proxy` / `all_proxy`, not exempted by `no_proxy`),
 * which resolves for us and only ever reaches what its own resolver says. A
 * proxied request is not pinned either: the proxy chooses the address.
 *
 * The guard's opt-out (`SOVRIUM_ALLOW_PRIVATE_OUTBOUND`) switches this off with
 * the rest of the guard.
 */

import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { isSsrfRelaxed } from '@/infrastructure/process/security-posture'
import { isPrivateOutboundHost } from './validate-outbound-url'

/** The addresses a host name resolves to. @public */
export type ResolveHost = (hostname: string) => Promise<readonly string[]>

/** The machine's own resolver, every address of the name. @public */
export const systemResolveHost: ResolveHost = async (hostname) =>
  (await lookup(hostname, { all: true, verbatim: true })).map((entry) => entry.address)

/** The environment the proxy variables are read from. @public */
export type ProxyEnv = Readonly<Record<string, string | undefined>>

/**
 * What the guard does with one hop's host:
 *
 *   - `as-is`   — send to the URL as written (an address literal, the guard
 *                 relaxed, or a proxied request);
 *   - `pinned`  — send to `address`, the name kept as `Host` and TLS name;
 *   - `refused` — send nothing: the name resolves to a private address, or
 *                 cannot be resolved and nothing else will resolve it.
 *
 * @public
 */
export type HostVerdict =
  | { readonly kind: 'as-is' }
  | { readonly kind: 'pinned'; readonly address: string }
  | { readonly kind: 'refused'; readonly detail: 'resolved' | 'unresolvable' }

/** The host as the resolver reads it: no IPv6 brackets, no trailing dot. */
const bareHost = (hostname: string): string => {
  const unbracketed = hostname.startsWith('[') ? hostname.slice(1, -1) : hostname
  return unbracketed.endsWith('.') ? unbracketed.slice(0, -1) : unbracketed
}

/** A proxy variable's value, lower-case name first as curl and Bun read them; blank is unset. */
const proxyVar = (env: ProxyEnv, name: string): string | undefined => {
  const value = env[name] ?? env[name.toUpperCase()]
  return value === undefined || value.trim() === '' ? undefined : value
}

/**
 * Whether `no_proxy` exempts `host`. Read MORE broadly than the HTTP client
 * reads it — an entry's port is ignored and any domain suffix matches — so a
 * doubt counts as "sent directly", the case in which an unresolvable name is
 * refused.
 */
const isExempted = (env: ProxyEnv, host: string): boolean =>
  (proxyVar(env, 'no_proxy') ?? '')
    .split(/[\s,]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry !== '')
    .some((entry) => {
      if (entry === '*') return true
      const domain = entry.replace(/^\*?\./, '').replace(/:\d+$/, '')
      return host === domain || host.endsWith(`.${domain}`)
    })

/** Whether a request to `url` leaves through an outbound proxy rather than directly. @public */
export const isProxied = (url: URL, env: ProxyEnv): boolean => {
  const scheme = url.protocol === 'http:' ? 'http_proxy' : 'https_proxy'
  const proxy = proxyVar(env, scheme) ?? proxyVar(env, 'all_proxy')
  return proxy !== undefined && !isExempted(env, bareHost(url.hostname).toLowerCase())
}

/**
 * How the guard sends to `url`'s host: as written, pinned to a checked
 * address, or not at all. See {@link HostVerdict}.
 *
 * @public
 */
export const judgeHost = async (
  url: URL,
  resolve: ResolveHost,
  env: ProxyEnv = process.env
): Promise<HostVerdict> => {
  const host = bareHost(url.hostname)
  if (isSsrfRelaxed() || host === '' || isIP(host) !== 0) return { kind: 'as-is' }
  const proxied = isProxied(url, env)
  const addresses = await resolve(host).catch((): readonly string[] => [])
  if (addresses.some((address) => isPrivateOutboundHost(address))) {
    return { kind: 'refused', detail: 'resolved' }
  }
  if (proxied) return { kind: 'as-is' }
  const [first] = addresses
  return first === undefined
    ? { kind: 'refused', detail: 'unresolvable' }
    : { kind: 'pinned', address: first }
}

/**
 * The request that reaches the address a verdict pinned: the URL's host
 * replaced by the address, the name carried as `Host` and — over TLS — as the
 * server name the certificate is checked against. Any other verdict sends the
 * request unchanged.
 *
 * @public
 */
export const pinnedRequest = <Init extends RequestInit>(
  url: URL,
  init: Init,
  verdict: HostVerdict
): { readonly target: URL; readonly init: Init } => {
  if (verdict.kind !== 'pinned') return { target: url, init }
  const target = new URL(url.href)
  target.hostname = isIP(verdict.address) === 6 ? `[${verdict.address}]` : verdict.address
  const headers = new Headers(init.headers)
  headers.set('host', url.host)
  const tls = url.protocol === 'https:' ? { tls: { serverName: bareHost(url.hostname) } } : {}
  return { target, init: { ...init, headers, ...tls } }
}
