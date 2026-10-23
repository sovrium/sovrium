/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { buildWebAppManifest } from '@/domain/models/app/install/install-service'
import { normalizeFavicons } from '@/domain/models/app/pages/meta/favicon-transformer'
import { getSovriumVersionSync } from '@/infrastructure/process/version'
import {
  MANIFEST_PATH,
  OFFLINE_PATH,
  SERVICE_WORKER_PATH,
  shellCacheName,
} from '@/presentation/render/scripts/install-tags'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

/**
 * The offline page. Fixed engine text with no app data and no reader data, so
 * a cached copy on a shared device says nothing about anyone.
 */
const OFFLINE_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Offline</title></head><body><main><h1>You are offline</h1><p>This page needs a connection. It opens again once you are back online.</p></main></body></html>`

/**
 * The offline shell's worker. A constant engine script with two values
 * written in: the engine release (named in its first line) and the app's own
 * `version`, which together name its one cache (`shellCacheName`), so either
 * changing is a new worker and a new cache.
 *
 * It keeps two things: the offline page, cached once every other
 * `sovrium-shell-` cache is gone (so the new release's cache never sits beside
 * an old one, an earlier engine's included), and the built static assets under
 * `/assets/`, each copied once into the release's cache beside the page's own
 * request. While the browser is online
 * the worker stands in the path of nothing: every request goes to the network
 * as if it were not there, so a slow or restarting server never leaves a page
 * waiting on the worker. Offline, a navigation gets the offline page and an
 * asset its cached copy. A worker writes only into a cache that still exists,
 * so a worker on its way out never brings back the cache its successor
 * deleted. An `/api/` answer, a page's HTML, `/_admin` and the sign-in routes
 * are never written to a cache.
 */
const serviceWorkerScript = (engine: string, release: string): string =>
  `/* sovrium ${engine} */const C=${JSON.stringify(shellCacheName(engine, release))};const O="${OFFLINE_PATH}";` +
  `self.addEventListener("install",function(e){e.waitUntil(self.skipWaiting())});` +
  `self.addEventListener("activate",function(e){e.waitUntil(caches.keys().then(function(k){return Promise.all(k.filter(function(n){return n.indexOf("sovrium-shell-")===0&&n!==C}).map(function(n){return caches.delete(n)}))}).then(function(){return caches.open(C)}).then(function(c){return c.add(O)}).then(function(){return self.clients.claim()}))});` +
  `self.addEventListener("fetch",function(e){var r=e.request;if(r.method!=="GET")return;var u=new URL(r.url);if(u.origin!==self.location.origin)return;` +
  `var off=self.navigator.onLine===false;` +
  `if(r.mode==="navigate"){if(off)e.respondWith(caches.match(O).then(function(m){return m||fetch(r)}));return}` +
  `if(u.pathname.indexOf("/assets/")!==0)return;` +
  `if(off){e.respondWith(caches.match(r).then(function(m){return m||fetch(r)}));return}` +
  `e.waitUntil(caches.has(C).then(function(h){if(h)return caches.open(C).then(function(c){return c.match(r).then(function(m){if(!m)return c.add(r)})})}).catch(function(){}))});`

/** A route of the installable app answers 404 when the app does not ask for it. */
const notServed = (c: Context): Response => c.text('Not found', 404)

/**
 * The installable app's three addresses (`install`): the generated web app
 * manifest, and — under `install.offline` — the offline shell's worker and its
 * offline page. Registered ahead of the page routes so no page, a catch-all
 * `/:slug` included, can answer them, and answering 404 when the app does not
 * declare what they serve. None carries anything of a reader: the manifest is
 * the app's, the worker and the page the engine's.
 */
export function setupInstallRoutes(honoApp: Readonly<Hono>, app: App): Readonly<Hono> {
  const offline = app.install?.offline === true
  const worker = serviceWorkerScript(getSovriumVersionSync(), app.version ?? '')
  return (honoApp as Hono)
    .get(MANIFEST_PATH, (c) => {
      const home = (app.pages ?? []).find((page) => page.path === '/')
      const manifest = buildWebAppManifest(app, normalizeFavicons(home?.meta?.favicons) ?? [])
      if (manifest === undefined) return notServed(c)
      return c.body(JSON.stringify(manifest), 200, {
        'Content-Type': 'application/manifest+json; charset=utf-8',
        'Cache-Control': 'no-cache',
      })
    })
    .get(SERVICE_WORKER_PATH, (c) =>
      offline
        ? c.body(worker, 200, {
            'Content-Type': 'text/javascript; charset=utf-8',
            'Cache-Control': 'no-cache',
            'Service-Worker-Allowed': '/',
          })
        : notServed(c)
    )
    .get(OFFLINE_PATH, (c) =>
      offline
        ? c.body(OFFLINE_PAGE, 200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache',
          })
        : notServed(c)
    )
}
