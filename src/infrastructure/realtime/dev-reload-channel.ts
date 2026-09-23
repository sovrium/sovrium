/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The in-process channel a `--watch` hot swap pushes down, and the one function
 * that pushes it.
 *
 * It lives in `infrastructure/realtime/` rather than beside the SSE route it
 * feeds, and the reason is a single reverse edge. `server-reload.ts` — the
 * hot-swap path, infrastructure by every measure — called `notifyDevReload`,
 * whose module moved to `presentation/api/server/` in W5a. That made the server
 * lifecycle an importer of presentation, which is the direction the layer rule
 * exists to forbid.
 *
 * Splitting the PUSH from the STREAM is what removes the edge rather than
 * papering over it. The push names no Hono type and no Effect stream: it is
 * `publishToChannel(channel, message)`, which is `infrastructure/realtime/`'s
 * own vocabulary, so it was already in the wrong file. The SUBSCRIBE half —
 * the SSE endpoint, the injected client script, the env gate — stays in
 * `presentation/api/server/dev-reload-routes.ts`, where a route belongs, and
 * imports the two constants from here.
 *
 * Reusing the record-change fan-out rather than growing a second registry: it
 * already owns the "one listener per open connection, unsubscribed on teardown,
 * one dead connection cannot block delivery to the rest" contract, which is
 * exactly what a push to every open dev tab needs. The name is namespaced the
 * same way the routes are, so it can never collide with a `table:<app>:<name>`
 * channel.
 */

import { publishToChannel } from '@/infrastructure/realtime/channel-manager'
import type { ConfigFinding } from '@/domain/models/app/app-excess-property-report'

/** The in-process channel every open dev-reload stream listens on. */
export const DEV_RELOAD_CHANNEL = '__sovrium_dev:reload'

/** The message an APPLIED save pushes. */
export const DEV_RELOAD_MESSAGE = { type: 'reload' } as const

/**
 * Tell every open dev page that the server it is talking to now runs a new
 * config. Called from the hot-swap path, which keeps the listener bound and so
 * has no reconnect to rely on.
 *
 * A no-op when nothing is listening (no dev tab open, or the routes are not
 * mounted at all outside local dev), so the reload path can call it
 * unconditionally.
 */
export const notifyDevReload = (): void => {
  publishToChannel(DEV_RELOAD_CHANNEL, DEV_RELOAD_MESSAGE)
}

/**
 * Tell every open dev page that the save it is waiting for was REFUSED, and why.
 *
 * This is the one outcome a browser cannot infer. A successful save changes what
 * is served; a failed boot drops the connection. A refusal does neither — the
 * last-good server keeps answering 200 with a perfectly good page, which is
 * correct behaviour and the worst possible signal. Every channel the page
 * already has reports "nothing to see", and the only place the news exists is a
 * terminal the reader is not looking at.
 *
 * `findings` rather than a sentence, and the same findings the status file and
 * `sovrium validate --json` carry: what the page has to show is a position, a
 * complaint and what may be written instead. A prose line carrying all three
 * inside it has to be parsed back apart by every consumer, differently.
 *
 * A no-op when nothing is listening, so the watcher can call it unconditionally.
 */
export const notifyDevError = (findings: readonly ConfigFinding[]): void => {
  publishToChannel(DEV_RELOAD_CHANNEL, { type: 'error', findings })
}
