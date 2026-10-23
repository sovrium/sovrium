/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { App } from '@/domain/models/app'

/** The address of the generated web app manifest. */
export const MANIFEST_PATH = '/manifest.webmanifest'

/** The address of the offline shell's service worker. */
export const SERVICE_WORKER_PATH = '/service-worker.js'

/** The one page the offline shell keeps: it says the reader is offline, and nothing else. */
export const OFFLINE_PATH = '/sovrium-offline.html'

/** Every cache the offline shell writes starts with this prefix, and no other cache does. */
const CACHE_PREFIX = 'sovrium-shell-'

/**
 * The name of the offline shell's one cache: the engine release, then the
 * app's own `version` when it declares one (`sovrium-shell-0.41.0+1.4.0`,
 * `sovrium-shell-0.41.0`). A change of either is a new name, and every
 * `sovrium-shell-` cache under another name is deleted on the next visit.
 */
export const shellCacheName = (engine: string, release: string): string =>
  `${CACHE_PREFIX}${engine}${release === '' ? '' : `+${release}`}`

/**
 * Register the offline shell's worker over the whole site, and keep the caches
 * in step with the release. The cache's name rides on the script address, so a
 * new engine or app release is a new worker, which replaces the caches when it
 * takes over; the page also drops every other `sovrium-shell-` cache and lays
 * the current one's offline page down itself, so a release never waits on the
 * moment the browser lets the new worker in.
 */
const registerScript = (name: string): string => {
  const cache = JSON.stringify(name)
  return `if("serviceWorker"in navigator){navigator.serviceWorker.register("${SERVICE_WORKER_PATH}?v=${encodeURIComponent(name.slice(CACHE_PREFIX.length))}",{scope:"/"});if(self.caches){caches.keys().then(function(k){k.forEach(function(n){if(n.indexOf("${CACHE_PREFIX}")===0&&n!==${cache})caches.delete(n)})}).then(function(){return caches.open(${cache})}).then(function(c){return c.match("${OFFLINE_PATH}").then(function(m){return m||c.add("${OFFLINE_PATH}")})}).catch(function(){})}}`
}

/**
 * Unregister a worker an earlier release registered, and drop its caches: the
 * app no longer asks for an offline shell, so nothing of it may stay behind.
 */
const UNREGISTER_SCRIPT = `if("serviceWorker"in navigator){navigator.serviceWorker.getRegistrations().then(function(r){r.forEach(function(g){g.unregister()})});if(self.caches){caches.keys().then(function(k){k.forEach(function(n){if(n.indexOf("${CACHE_PREFIX}")===0)caches.delete(n)})})}}`

/** `html` with `tag` inserted right before `closing`, or appended when it has none. */
const insertBefore = (html: string, closing: string, tag: string): string => {
  const at = html.lastIndexOf(closing)
  return at === -1 ? `${html}${tag}` : `${html.slice(0, at)}${tag}${html.slice(at)}`
}

/**
 * A rendered page of an installable app (`install`): the generated manifest
 * linked in its head — unless the page's own favicon set already links one —
 * and, at the end of its body, the offline shell's worker registered
 * (`install.offline`) or a worker an earlier release registered taken away.
 * `engine` is the engine release serving the page, which names the shell's
 * cache with the app's `version`. Every other page is returned unchanged.
 * Nothing here is the reader's: the same tags go to every visitor of the app.
 */
export const withInstallTags = (
  html: string,
  { app, engine }: { readonly app: Pick<App, 'install' | 'version'>; readonly engine: string }
): string => {
  const { install } = app
  if (install === undefined) return html
  const linked = html.includes('rel="manifest"')
    ? html
    : insertBefore(html, '</head>', `<link rel="manifest" href="${MANIFEST_PATH}">`)
  const script =
    install.offline === true
      ? registerScript(shellCacheName(engine, app.version ?? ''))
      : UNREGISTER_SCRIPT
  return insertBefore(linked, '</body>', `<script>${script}</script>`)
}
