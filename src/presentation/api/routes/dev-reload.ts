/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Stream } from 'effect'
import { runEffectSse } from '@/presentation/api/utils/effect-sse'
import type { Hono } from 'hono'

export const DEV_RELOAD_SSE_PATH = '/__sovrium_dev/reload'

export const DEV_RELOAD_SCRIPT_PATH = '/assets/dev-reload.js'

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

export function chainDevReloadRoutes<T extends Hono>(honoApp: T) {
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
