/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A local server answers only the names that point at the machine itself.
 *
 * A server bound to loopback with neither `BASE_URL` nor `TRUSTED_PROXY_HOPS`
 * set is a developer's machine or the desktop app: nobody else can reach its
 * socket. A web page can, though, by DNS rebinding — a name the attacker owns
 * that first resolves to their server, then to `127.0.0.1` — and the browser
 * then treats the local server as the attacker's own origin, free to read
 * every answer. The one thing such a request cannot fake is its `Host`: it
 * names the attacker's domain. So a request addressed to any name other than
 * `localhost`, `127.0.0.1`, `[::1]`, the address the server binds, the host of
 * a loopback `BASE_URL`, or a `*.localhost` name is answered as an address
 * that serves nothing here: the platform's not-found answer, drawn without the
 * app. A request with no `Host` (HTTP/1.0) cannot be such a page, and is served.
 *
 * Armed only when the server is strictly local (`isStrictlyLocalOrigin()`): a
 * declared public origin or proxy says which names are expected, and a
 * server on a Unix socket (`SOVRIUM_LISTEN_UNIX`) is reached through a file no
 * web page can open.
 *
 * The same posture warns once when it looks misdeclared: a request under
 * another name, or one forwarded over `https`, means a reverse proxy the
 * operator put in front of the server without saying so. The warning names
 * the two variables to set and echoes nothing of the request.
 */

import { isLoopbackHostname } from '@/domain/kernel/url/loopback-host'
import {
  resolveBindHost,
  SOVRIUM_LISTEN_UNIX_VAR,
} from '@/domain/models/process-env/server-lifecycle'
import { logWarning } from '@/infrastructure/logging/logger'
import {
  isStrictlyLocalOrigin,
  resolveCanonicalHost,
} from '@/infrastructure/process/security-posture'
import type { Context, MiddlewareHandler } from 'hono'

/** The one line a strictly local server prints when a proxy seems to stand in front of it. */
export const UNDECLARED_PROXY_WARNING =
  '[server] This server received a request forwarded over https or addressed to a name other than this machine, but neither BASE_URL nor TRUSTED_PROXY_HOPS is set, so it answers only localhost. Set BASE_URL to the public address, or TRUSTED_PROXY_HOPS to the number of proxies in front of the server.'

/**
 * The host name a `Host` header names, lowercased, without its port, the
 * brackets of an IPv6 literal, or one trailing dot.
 */
export const hostNameOf = (host: string): string => {
  const lowered = host.trim().toLowerCase()
  if (lowered.startsWith('[')) {
    const end = lowered.indexOf(']')
    return end === -1 ? lowered.slice(1) : lowered.slice(1, end)
  }
  const name = lowered.replace(/:\d*$/, '')
  return name.endsWith('.') ? name.slice(0, -1) : name
}

/** Does `name` point at this machine, or at an address this server declared? */
export const isMachineName = (name: string, declared: readonly string[]): boolean =>
  name !== '' &&
  (isLoopbackHostname(name) || name.endsWith('.localhost') || declared.includes(name))

/** The names this server was told it answers to: its bind address and a loopback `BASE_URL`'s host. */
// The bind host and the unix-socket switch are not on `ServerEnv` yet, so they
// read the process environment directly until they move there.
const declaredNames = (): readonly string[] =>
  [resolveBindHost(process.env).host, resolveCanonicalHost() ?? '']
    .map((name) => hostNameOf(name))
    .filter((name) => name !== '')

const isForwardedOverHttps = (c: Context): boolean =>
  (c.req.header('x-forwarded-proto') ?? '').split(',')[0]?.trim().toLowerCase() === 'https'

/**
 * The guard, or a pass-through when the server is not strictly local.
 * `notFound` draws the refusal: the platform's own not-found answer.
 */
export const localHostNames = (
  notFound: (c: Context) => Response | Promise<Response>
): MiddlewareHandler => {
  const unixSocket = (process.env[SOVRIUM_LISTEN_UNIX_VAR] ?? '') !== ''
  if (!isStrictlyLocalOrigin() || unixSocket) return async (_c, next) => next()
  const declared = declaredNames()
  let warned = false
  const warnOnce = (): void => {
    if (warned) return
    warned = true
    logWarning(UNDECLARED_PROXY_WARNING)
  }
  return async (c, next) => {
    const host = c.req.header('host')
    const foreign = host !== undefined && !isMachineName(hostNameOf(host), declared)
    if (foreign || isForwardedOverHttps(c)) warnOnce()
    return foreign ? notFound(c) : next()
  }
}
