/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type Hono } from 'hono'
import { declaresFavicon } from '@/domain/models/app/install/install-service'
import type { App } from '@/domain/models/app'

/**
 * The neutral default icon: one 32×32 grey rounded square, a PNG inside an ICO
 * container, 163 bytes. Kept as bytes in the server, never written into a
 * page, so it costs a reader one request, cached, on a first visit only.
 */
const DEFAULT_FAVICON = Uint8Array.from(
  atob(
    'AAABAAEAICAAAAEAIACNAAAAFgAAAIlQTkcNChoKAAAADUlIRFIAAAAgAAAAIAgGAAAAc3p69AAAAFRJREFUeNrt18ENACAIQ1FW5uryOoERDQgJvwnnvmMRIYaojvlyKaUuGO/yK0RUuQkRXX5E9Ab8Kt8iAAAAAAAAgHQAe6AEIH2UlpjlJR6TEq9ZmyxlNIQHeLRVKQAAAABJRU5ErkJggg=='
  ),
  (char) => char.charCodeAt(0)
)

/** A day: the icon never changes within a release, and a new one is not urgent. */
const DEFAULT_FAVICON_CACHE_CONTROL = 'public, max-age=86400'

/**
 * Answer `/favicon.ico` for an app that declares no favicon.
 *
 * Every browser asks a site for `/favicon.ico` on its first visit, and an app
 * without one answered 404: a console error on each first load and a blank
 * tab. Registered after the app's `public/` route, so a `favicon.ico` the app
 * ships itself still wins; an app that declares a favicon gets no route at
 * all, so the default never stands in for the icon it chose.
 */
export function setupDefaultFaviconRoute(honoApp: Readonly<Hono>, app: App): Readonly<Hono> {
  if (declaresFavicon(app)) return honoApp
  return honoApp.get(
    '/favicon.ico',
    () =>
      new Response(DEFAULT_FAVICON, {
        headers: {
          'Content-Type': 'image/x-icon',
          'Cache-Control': DEFAULT_FAVICON_CACHE_CONTROL,
        },
      })
  )
}
