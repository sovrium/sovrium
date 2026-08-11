/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Dev-only live-reload routes for `sovrium start --watch`.
 *
 * Two routes:
 *  - `GET /__sovrium_dev/reload` — an SSE stream whose preamble carries a
 *    `generation` token unique to THIS server start. The stream self-closes
 *    after the SSE lifetime ceiling and the browser `EventSource` auto-reconnects.
 *    A `--watch` reload tears this server down and starts a fresh one (a new
 *    `chainDevReloadRoutes` call → a new `generation`), so the reconnect observes
 *    a changed token and the client reloads. A reconnect after mere
 *    lifetime-expiry sees the SAME token and does nothing (no reload loop).
 *  - `GET /assets/dev-reload.js` — the tiny client script injected into dev HTML
 *    (see PageBodyScripts). External `src`, NOT inline, so it does not perturb the
 *    strict-CSP inline-script-count contract.
 *
 * Mounting (and the production gate) lives in the infrastructure route-setup —
 * this module only owns the handler behaviour, keeping the `runEffectSse`
 * dependency inside the presentation layer.
 */

import { Stream } from 'effect'
import { runEffectSse } from '@/presentation/api/utils/effect-sse'
import type { Hono } from 'hono'

/** SSE endpoint path. Namespaced under `/__sovrium_dev/` to avoid app routes. */
export const DEV_RELOAD_SSE_PATH = '/__sovrium_dev/reload'

/** External client-script path injected into dev HTML. */
export const DEV_RELOAD_SCRIPT_PATH = '/assets/dev-reload.js'

/**
 * The injected client. Opens the SSE stream and reloads the page when the
 * server `generation` changes (i.e. after a `--watch` restart), using
 * sessionStorage to remember the last-seen generation across the reload so the
 * freshly-loaded page does not reload again. Heartbeats and any non-`connected`
 * messages are ignored.
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
      if (!message || message.type !== 'connected') return
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

  return honoApp
    .get(DEV_RELOAD_SSE_PATH, (c) =>
      runEffectSse(c, Stream.never, () => ({ kind: 'data', payload: {} }), {
        preamble: [{ type: 'connected', generation }],
      })
    )
    .get(DEV_RELOAD_SCRIPT_PATH, (c) =>
      c.body(clientScript, 200, {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'no-store',
      })
    )
}
