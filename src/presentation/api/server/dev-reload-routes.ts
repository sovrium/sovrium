/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Dev-only live-reload routes for `sovrium start --watch`, and the env gate
 * that decides whether they are mounted at all.
 *
 * Two routes:
 *  - `GET /__sovrium_dev/reload` — an SSE stream carrying TWO delivery
 *    mechanisms, because a `--watch` reload now has two shapes:
 *      * a PUSHED `{"type":"reload"}` message on the already-open stream,
 *        which is how an IN-PLACE hot swap reaches the page. The listener
 *        survives the swap, so there is no reconnect left to carry the news
 *        and it has to be sent over the connection the page already holds;
 *      * the `generation` token in the preamble, which is how a FULL RESTART
 *        reaches it. That path tears the server down, the `EventSource`
 *        reconnects against the freshly built app (a new `chainDevReloadRoutes`
 *        call -> a new `generation`), and the client sees a changed token. A
 *        reconnect after mere lifetime-expiry sees the SAME token and does
 *        nothing, so there is no reload loop.
 *  - `GET /assets/dev-reload.js` — the tiny client script injected into dev HTML
 *    (see PageBodyScripts). External `src`, NOT inline, so it does not perturb the
 *    strict-CSP inline-script-count contract.
 *
 * ## Why this is ONE file again
 *
 * It was two — an infrastructure `dev-reload-routes.ts` holding the env gate
 * and a presentation `dev-reload.ts` holding the handlers — and the split
 * bought exactly one thing: keeping the `runEffectSse` import out of an
 * infrastructure module. W5a moved both into `presentation/api/server/`, so
 * that reason is gone and the split is now two files to read for one surface.
 * The re-export of `notifyDevReload` went with it: it existed so the
 * server-lifecycle side reached the dev-reload surface "through the same
 * infrastructure module that owns its mounting", and there is no longer an
 * infrastructure module in the path.
 *
 * ## What is NOT here
 *
 * The PUSH. `notifyDevReload` and the channel constants live in
 * `infrastructure/realtime/dev-reload-channel.ts` (W5b), because the hot-swap
 * path in `server-reload.ts` calls the push and infrastructure must not import
 * presentation to do it. This file owns the SUBSCRIBE half — the SSE endpoint,
 * the injected client, the env gate.
 */

import { Effect, Queue, Stream } from 'effect'
import { isLiveReloadEligible } from '@/infrastructure/process/env'
import { addChannelListener } from '@/infrastructure/realtime/channel-manager'
import { DEV_RELOAD_CHANNEL } from '@/infrastructure/realtime/dev-reload-channel'
import { runEffectSse } from '@/presentation/api/runtime/effect-sse'
import type { Hono } from 'hono'

/** SSE endpoint path. Namespaced under `/__sovrium_dev/` to avoid app routes. */
export const DEV_RELOAD_SSE_PATH = '/__sovrium_dev/reload'

/** External client-script path injected into dev HTML. */
export const DEV_RELOAD_SCRIPT_PATH = '/assets/dev-reload.js'

/**
 * The injected client. Opens the SSE stream and reloads the page on either
 * signal: a pushed `reload` message (an in-place hot swap), or a `connected`
 * preamble whose `generation` differs from the last one seen (a full restart,
 * observed on reconnect). sessionStorage remembers the last-seen generation
 * across the page reload so the freshly-loaded page does not reload again.
 * Heartbeats and any other message are ignored.
 */
const buildClientScript = (): string =>
  `(function () {
  var KEY = '__sovrium_reload_generation'
  try {
    var source = new EventSource(${JSON.stringify(DEV_RELOAD_SSE_PATH)})
    source.onmessage = function (event) {
      var message
      try {
        message = JSON.parse(event.data)
      } catch (_) {
        return
      }
      if (!message) return
      if (message.type === 'reload') {
        location.reload()
        return
      }
      if (message.type !== 'connected') return
      var seen = sessionStorage.getItem(KEY)
      if (seen === null) {
        sessionStorage.setItem(KEY, message.generation)
        return
      }
      if (seen !== message.generation) {
        sessionStorage.setItem(KEY, message.generation)
        location.reload()
      }
    }
  } catch (_) {
    /* EventSource unsupported — dev live-reload silently disabled */
  }
})()
`

/**
 * Chain the dev live-reload routes onto a Hono app. The caller is responsible
 * for the production gate (see `setupDevReloadRoute`).
 *
 * @param honoApp - Hono application instance.
 * @returns The Hono app with the two dev-reload routes chained.
 */
export function chainDevReloadRoutes<T extends Hono>(honoApp: T) {
  // A nonce unique to this server start. A --watch reload builds a new Hono app
  // (a fresh call here → a new generation), which is exactly the change the
  // client detects on reconnect.
  const generation = crypto.randomUUID()
  const clientScript = buildClientScript()

  // One listener per open connection, torn down with the stream's scope. The
  // source used to be `Stream.never`, which is what made the reconnect the
  // only delivery mechanism — a stream that emits nothing has nothing to push
  // a hot swap onto. Same `Stream.callback` shape as the record-subscription
  // endpoint, including the finalizer: v4 does NOT treat the returned effect
  // as the cleanup, so the unsubscribe must be registered against the scope or
  // it never runs and the listener leaks on every disconnect.
  const source = Stream.callback<Record<string, unknown>>((queue) =>
    Effect.gen(function* () {
      const unsubscribe = addChannelListener(DEV_RELOAD_CHANNEL, (event) => {
        // eslint-disable-next-line functional/no-expression-statements -- synchronous push into the stream queue
        Queue.offerUnsafe(queue, event)
      })
      yield* Effect.addFinalizer(() => Effect.sync(() => unsubscribe()))
    })
  )

  return honoApp
    .get(DEV_RELOAD_SSE_PATH, (c) =>
      runEffectSse(c, source, (event) => ({ kind: 'data', payload: event }), {
        preamble: [{ type: 'connected', generation }],
        // The reconnect IS the delivery mechanism here: the page only learns
        // about a new `generation` when it re-opens the stream against the
        // reloaded server. Left to a browser's own default (3 s in Chrome)
        // that reconnect is the single largest cost of a `--watch` save,
        // dwarfing the reload itself. 100 ms is cheap because the stream drops
        // only when the dev server restarts.
        retryMs: 100,
      })
    )
    .get(DEV_RELOAD_SCRIPT_PATH, (c) =>
      c.body(clientScript, 200, {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'no-store',
      })
    )
}

/**
 * Mount the dev live-reload routes. No-op unless {@link isLiveReloadEligible}
 * (routes 404 otherwise), so the caller can mount unconditionally.
 *
 * The gate is `NODE_ENV` unset/empty — the genuine local-dev default — so the
 * routes are absent in production AND in the in-process E2E test server, which
 * sets `NODE_ENV=development` only to skip the production CSS check.
 *
 * @param honoApp - Hono application instance.
 * @returns The Hono app with dev-reload routes chained (or unchanged).
 */
export function setupDevReloadRoute(honoApp: Readonly<Hono>): Readonly<Hono> {
  if (!isLiveReloadEligible()) return honoApp
  return chainDevReloadRoutes(honoApp as Hono)
}
