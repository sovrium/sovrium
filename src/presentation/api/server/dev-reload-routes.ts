/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Dev-only live-reload routes for `sovrium start --watch`, and the tag that
 * loads their client into every HTML page — mounted together or not at all.
 *
 * Two routes:
 *  - `GET /__sovrium_dev/reload` — an SSE stream carrying TWO delivery
 *    mechanisms, because a `--watch` reload now has two shapes:
 *      * a PUSHED `{"type":"reload"}` message on the already-open stream,
 *        which is how an IN-PLACE hot swap reaches the page. The listener
 *        survives the swap, so there is no reconnect left to carry the news
 *        and it has to be sent over the connection the page already holds;
 *      * a pushed `{"type":"error", findings}` message, which is how a REFUSED
 *        save reaches it. That one is not an optimisation: a refusal changes
 *        nothing the page can observe — the last-good server keeps answering
 *        200 with a good page — so without this message the only place the
 *        news exists is a terminal the reader is not looking at;
 *      * the `generation` token in the preamble, which is how a FULL RESTART
 *        reaches it. That path tears the server down, the `EventSource`
 *        reconnects against the freshly built app (a new `chainDevReloadRoutes`
 *        call -> a new `generation`), and the client sees a changed token. A
 *        reconnect after mere lifetime-expiry sees the SAME token and does
 *        nothing, so there is no reload loop.
 *  - `GET /assets/dev-reload.js` — the tiny client script, loaded by the
 *    `<script src>` tag {@link injectDevReloadTag} appends to every HTML
 *    response. External `src`, NOT inline, so it does not perturb the
 *    strict-CSP inline-script-count contract.
 *
 * The tag is added HERE, by the same mount that serves the script, rather than
 * by the page renderer. It used to be rendered by `PageBodyScripts` behind its
 * own read of `NODE_ENV`, so a surface that never mounts these routes — the
 * app a static build renders through — still printed a tag naming a script it
 * would not ship. One mount now decides both, so a page can only load the
 * client from a server that answers it.
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
 * the injected client and the tag that loads it.
 */

import { Effect, Queue, Stream } from 'effect'
import { addChannelListener } from '@/infrastructure/realtime/channel-manager'
import { DEV_RELOAD_CHANNEL } from '@/infrastructure/realtime/dev-reload-channel'
import { runEffectSse } from '@/presentation/api/runtime/effect-sse'
import type { Hono, MiddlewareHandler } from 'hono'

/** SSE endpoint path. Namespaced under `/__sovrium_dev/` to avoid app routes. */
export const DEV_RELOAD_SSE_PATH = '/__sovrium_dev/reload'

/** External client-script path injected into dev HTML. */
export const DEV_RELOAD_SCRIPT_PATH = '/assets/dev-reload.js'

/**
 * The half of the client that paints a REFUSED save, kept as its own constant.
 *
 * Framework-free and inline-styled on purpose: this ships to every dev page, and
 * a stylesheet it depended on would be one more thing a refused save could have
 * broken. It is a module constant rather than part of `buildClientScript`
 * because the composed function would otherwise be the longest in the file for
 * no reason a reader benefits from.
 *
 * ## Why it sits OVER the page rather than replacing it
 *
 * The previous version IS still serving — that is what `kept` means — so hiding
 * it would tell the reader the opposite of the truth. The panel is anchored to
 * the bottom, bounded to a fraction of the viewport and scrolls its own
 * overflow, so the running app stays both visible and usable while the news is
 * on screen.
 *
 * ## Why it prints `accepted` in full
 *
 * It is the only part that says what to write INSTEAD. A truncated list reads as
 * the complete one, which is how a reader is sent away from a legal value with
 * confidence — the same reason the producers of that list are all-or-nothing
 * about it (see `unionDiscriminantValues`).
 */
const OVERLAY_CLIENT = `
  var OVERLAY_ID = '__sovrium_dev_overlay'
  var MONO = 'font-family:ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-word'
  function clearOverlay() {
    var node = document.getElementById(OVERLAY_ID)
    if (node && node.parentNode) node.parentNode.removeChild(node)
  }
  function overlayRow(label, text, mono) {
    var row = document.createElement('div')
    row.textContent = label + text
    row.style.cssText = 'margin-top:4px;opacity:.9;' + (mono ? MONO : '')
    return row
  }
  function paintOverlay(findings) {
    if (!document.body) return
    clearOverlay()
    var box = document.createElement('div')
    box.id = OVERLAY_ID
    box.setAttribute('data-sovrium-dev-overlay', '')
    box.setAttribute('role', 'alert')
    box.style.cssText =
      'position:fixed;left:0;right:0;bottom:0;z-index:2147483647;max-height:45vh;' +
      'overflow:auto;padding:16px 20px;background:#221215;color:#ffe9ec;' +
      'border-top:3px solid #e5484d;font:13px/1.5 ui-sans-serif,system-ui,sans-serif'
    var head = document.createElement('strong')
    head.textContent = 'Sovrium refused this save. The previous version is still running.'
    head.style.cssText = 'display:block;font-size:14px'
    box.appendChild(head)
    for (var i = 0; i < findings.length; i++) {
      var finding = findings[i] || {}
      var item = document.createElement('div')
      item.style.cssText = 'margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,.14)'
      item.appendChild(overlayRow('', String(finding.message || 'Invalid configuration'), false))
      if (finding.path) item.appendChild(overlayRow('at ', String(finding.path), true))
      if (finding.sourceFile) item.appendChild(overlayRow('in ', String(finding.sourceFile), true))
      if (finding.accepted && finding.accepted.length) {
        item.appendChild(overlayRow('Accepted: ', finding.accepted.join(', '), true))
      }
      box.appendChild(item)
    }
    document.body.appendChild(box)
  }
`

/**
 * The injected client. Opens the SSE stream and reacts to three signals: a
 * pushed `reload` message (an in-place hot swap), a pushed `error` message (a
 * save the server refused, which changes nothing it serves and so cannot be
 * noticed any other way), or a `connected` preamble whose `generation` differs
 * from the last one seen (a full restart, observed on reconnect).
 * sessionStorage remembers the last-seen generation across the page reload so
 * the freshly-loaded page does not reload again. Heartbeats are ignored.
 */
const buildClientScript = (): string =>
  `(function () {
  var KEY = '__sovrium_reload_generation'
${OVERLAY_CLIENT}
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
      if (message.type === 'error') {
        paintOverlay(Array.isArray(message.findings) ? message.findings : [])
        return
      }
      if (message.type === 'reload') {
        // Cleared here as well as by the reload itself: a navigation that is
        // slow, or blocked by an onbeforeunload handler, would otherwise leave
        // a refusal on screen over an app that has already been corrected —
        // and a permanent alarm over a healthy page is worse than no alarm.
        clearOverlay()
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

/** The tag that loads the client, deferred like every other page script. */
const DEV_RELOAD_TAG = `<script src="${DEV_RELOAD_SCRIPT_PATH}" defer></script>`

/**
 * Append the live-reload tag to an HTML response, just before `</body>`.
 *
 * Every HTML surface of the dev server gets it — pages, the not-found page, a
 * mounted console — because each is a tab a developer may be looking at when
 * they save. A response that is not HTML, or has no `</body>`, passes through
 * untouched. The body is re-read and re-sent, so `Content-Length` is dropped
 * rather than left describing the shorter original.
 */
const injectDevReloadTag: MiddlewareHandler = async (c, next) => {
  await next()
  const contentType = c.res.headers.get('Content-Type') ?? ''
  if (!contentType.startsWith('text/html') || c.res.body === null) return
  const html = await c.res.text()
  const at = html.lastIndexOf('</body>')
  const headers = new Headers(c.res.headers)
  // eslint-disable-next-line drizzle/enforce-delete-with-where -- Headers.delete is the Fetch API Headers method, not a Drizzle query builder
  headers.delete('Content-Length')
  const body = at === -1 ? html : `${html.slice(0, at)}${DEV_RELOAD_TAG}${html.slice(at)}`
  // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements, no-param-reassign -- Hono's middleware contract replaces the response by assignment
  c.res = new Response(body, { status: c.res.status, statusText: c.res.statusText, headers })
}

/**
 * Mount the dev live-reload surface — both routes and the tag that loads the
 * client — when `enabled`, and nothing otherwise.
 *
 * The caller decides: the composition root passes the running server's
 * eligibility (`NODE_ENV` unset/empty, the genuine local-dev default) and
 * `false` for the app a static build renders through, which is never a
 * `--watch` session whatever the environment says. Absent, the routes 404 and
 * no page names the script — in production, under the in-process E2E server
 * (`NODE_ENV=development`), and in every static build.
 *
 * Registered ahead of the page routes (see `compose-hono-app.ts`), which is
 * what puts the tag middleware around every page response.
 *
 * @param honoApp - Hono application instance.
 * @param enabled - Whether this app serves the dev live-reload surface.
 * @returns The Hono app with the dev-reload surface chained (or unchanged).
 */
export function setupDevReloadRoute(honoApp: Readonly<Hono>, enabled: boolean): Readonly<Hono> {
  if (!enabled) return honoApp
  return chainDevReloadRoutes((honoApp as Hono).use('*', injectDevReloadTag))
}
