/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The address a server-side render uses to read THIS process's own API.
 *
 * ─── WHY NOT THE REQUEST'S URL ─────────────────────────────────────────────
 *
 * Behind a reverse proxy the incoming request names the PUBLIC origin: the
 * edge forwards `Host: example.com` to a plain-HTTP listener on some private
 * port. An internal read addressed at `new URL(endpoint, c.req.url)` therefore
 * leaves the process, goes back out through the edge — or, from inside a
 * container, nowhere at all — and fails. A page whose record is read that way
 * 404s for a caller who can read the record, while the endpoint itself answers
 * the same browser 200. Locally the two addresses coincide, which is why the
 * defect never showed there.
 *
 * ─── WHY NOT `BASE_URL` EITHER ─────────────────────────────────────────────
 *
 * `resolveServerOrigin` (`server/server-origin-live.ts`) prefers `BASE_URL`,
 * which is right for a link a HUMAN will open and wrong here for the same
 * reason the request URL is: it is the public name. What an internal read
 * wants is the socket the process actually bound, reached over loopback.
 *
 * ─── WHY IT IS READ OFF THE REQUEST, NOT PUBLISHED AT BOOT ─────────────────
 *
 * The listener that SERVED this request is the one to read back through, and
 * the request already carries it: `bun-listener.ts` hands Bun's live `server`
 * to Hono as `env`, so `getBunServer(c)` names it. A module-level "last bound
 * listener" would be one value shared by every server in the process — and
 * `serverMode: 'inprocess'` boots many servers inside one Playwright worker,
 * so a render on one app could read ANOTHER app's API with its visitor's
 * cookie. That is why `domain-runtime.ts` forbids module-level singletons, and
 * here the consequence would be a disclosure rather than a flaky test.
 *
 * ─── WHY A WILDCARD BIND IS REWRITTEN ──────────────────────────────────────
 *
 * `0.0.0.0` and `::` are bind addresses, not destinations: they mean "every
 * interface". A container binds exactly that, so the destination is the
 * loopback of the same family — which is also the narrowest address that
 * reaches the listener, and so the one that cannot widen the read's reach.
 */

import { getBunServer } from 'hono/bun'
import type { Context } from 'hono'

/**
 * The loopback origin for a listener bound to `hostname:port`.
 *
 * Wildcard binds become the loopback of their family; an IPv6 literal gains
 * the brackets a URL requires; any other name is kept, since the server bound
 * it by resolving that very name.
 */
export const toLoopbackOrigin = (hostname: string, port: number): string => {
  const bare = hostname.replace(/^\[(.*)\]$/, '$1')
  const host =
    bare === '0.0.0.0' || bare === ''
      ? '127.0.0.1'
      : bare === '::'
        ? '[::1]'
        : bare.includes(':')
          ? `[${bare}]`
          : bare
  return `http://${host}:${port}`
}

/** The two fields of Bun's `Server` this module reads. */
interface BoundListener {
  readonly hostname?: string
  readonly port?: number
}

/**
 * The loopback origin of the listener that served this request, or
 * `undefined` when the request did not arrive through a Bun listener — a Hono
 * app driven by `app.request()` in a unit test, say — in which case the
 * request's own URL is the only origin there is.
 */
export const resolveLoopbackOrigin = (
  // eslint-disable-next-line functional/prefer-immutable-types -- Hono's Context is mutable by design
  c: Context
): string | undefined => {
  // `getBunServer` reads `c.env` with an `in` check, which throws on a
  // non-object — and `app.request()` supplies none. Guard before the call.
  const { env } = c
  if (typeof env !== 'object' || env === null) return undefined
  const { hostname, port } = getBunServer<BoundListener>(c) ?? {}
  if (typeof hostname !== 'string' || typeof port !== 'number' || port <= 0) return undefined
  return toLoopbackOrigin(hostname, port)
}
