/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { realpath } from 'node:fs/promises'
import { join, sep } from 'node:path'
import { Effect } from 'effect'
import { type Context, type Hono } from 'hono'
import { inferMimeFromKey } from '@/domain/kernel/identity/mime-types'
import { hasPageSearchComponent } from '@/domain/models/app/pages/has-page-search'
import { searchIndexDir } from '@/domain/models/process-env/data-dir'
import { generateTrackingScript } from '@/infrastructure/analytics/tracking-script'
import {
  clientScriptSource,
  HASHED_TOP_LEVEL_ENTRIES,
  readClientEntry,
  readScript,
  resolveClientScriptPaths,
  serveHashedTopLevelEntry,
  servesPrebuiltEntries,
} from '@/infrastructure/assets/client-entries'
import { hashedEntryPattern, stableEntryResponse } from '@/infrastructure/assets/client-entry-hash'
import { compileCSS } from '@/infrastructure/css/compiler'
import {
  consoleCssHash,
  getVersionedCssHash,
  parseVersionedCssHash,
  VERSIONED_CSS_FILE_PATTERN,
} from '@/infrastructure/css/versioned-css-path'
import { logError, logDebug } from '@/infrastructure/logging/logger'
import { adminMountsFor, scopedAppForMount } from '../admin-mounts'
import {
  ENTRY_CACHE_CONTROL,
  assetCacheControl,
  getCacheControlHeader,
  isProduction,
} from './asset-cache-control'
import { setupClientChunkRoutes } from './client-chunk-routes'
import { setupBrandMarkRoute, setupDesignSystemSampleRoute } from './embedded-asset-routes'
import { setupIslandRoutes } from './island-assets'
import { PUBLIC_DIR_SECRET_BLOCKLIST } from './public-dir-blocklist'
import type { App } from '@/domain/models/app'

/**
 * Resolve WHICH app a versioned stylesheet request is asking for.
 *
 * The server hosts two apps, not one: the operator's, and Sovrium's own
 * `/_admin` console (a separate embedded config). Each links its own hash, so
 * the hash is the request's statement of which stylesheet it wants.
 *
 * Both stylesheets carry the SAME operator tokens — the operator's `design`
 * cascades onto the console chrome — and differ because the console's is
 * compiled from its own pages, its own single-zone map, its own preset classes,
 * and the scoped design-system layer no operator page carries. The hash selects
 * genuinely different content, not "themed" against "unthemed".
 *
 * Anything else — an unknown hash, or HTML cached from a previous deploy —
 * falls back to the operator app. That fallback is load-bearing: resolving by
 * hash makes "no app matches" a natural 404, and a 404 here leaves every
 * visitor still holding old HTML staring at an unstyled page. Serving working
 * CSS under a short cache header is always the better answer.
 */
const resolveCssApp = (requestedHash: string, operatorApp: App): App => {
  // Rebuilt rather than compared against a constant: the console's stylesheet
  // stopped being theme-independent when the design-system section began
  // drawing the operator's system FLAT in the console document. Its hash now
  // folds in that scoped layer, so recognising it means reconstructing the same
  // console app the rendered page linked — which is exactly what
  // `resolveScopedMountApp` memoizes, from the operator app this route
  // already holds.
  const consoleApp = adminMountsFor(operatorApp)
    .map((mount) => scopedAppForMount(mount, operatorApp))
    .find((candidate) => requestedHash === consoleCssHash(candidate))
  return consoleApp ?? operatorApp
}

/**
 * Setup CSS compilation route
 *
 * Serves dynamically compiled CSS with theme tokens at /assets/output.css
 *
 * @param honoApp - Hono application instance
 * @param app - Application configuration
 * @returns Hono app with CSS route configured
 */
export function setupCSSRoute(honoApp: Readonly<Hono>, app: App): Readonly<Hono> {
  return (
    honoApp
      .get('/assets/output.css', async (c) => {
        try {
          const result = await Effect.runPromise(compileCSS(app))

          return c.text(result.css, 200, {
            'Content-Type': 'text/css',
            'Cache-Control': getCacheControlHeader(),
          })
        } catch (error) {
          logError('[CSS] Compilation failed', error)
          return c.text('/* CSS compilation failed */', 500, {
            'Content-Type': 'text/css',
          })
        }
      })
      // The param MUST span the WHOLE path segment. Hono's router does not match
      // a param embedded mid-segment between a literal prefix and suffix
      // (`/assets/output-:hash{…}.css` compiles but never matches — every
      // rendered page then links a 404ing stylesheet and renders unstyled), so
      // the regex carries the `output-`/`.css` literals and the hash is sliced
      // back out of the matched filename.
      .get(`/assets/:file{${VERSIONED_CSS_FILE_PATTERN}}`, async (c) => {
        // Content-versioned stylesheet URL (linked by rendered HTML). The hash
        // is derived from the theme + candidate inputs that determine the CSS,
        // so it both SELECTS the app to compile (see `resolveCssApp` — the
        // operator's pages and Sovrium's console link different hashes and must
        // get different stylesheets) and decides how long the answer may be
        // cached. The CURRENT hash may be cached forever; a STALE hash (HTML
        // cached from a previous deploy) still gets working CSS under the short
        // header — never a 404 and never an unstyled page.
        try {
          const requestedHash = parseVersionedCssHash(c.req.param('file'))
          const cssApp = resolveCssApp(requestedHash, app)
          const result = await Effect.runPromise(compileCSS(cssApp))
          const isCurrent = requestedHash === getVersionedCssHash(cssApp)
          return c.text(result.css, 200, {
            'Content-Type': 'text/css',
            'Cache-Control':
              isCurrent && isProduction
                ? 'public, max-age=31536000, immutable'
                : getCacheControlHeader(),
          })
        } catch (error) {
          logError('[CSS] Compilation failed', error)
          return c.text('/* CSS compilation failed */', 500, {
            'Content-Type': 'text/css',
          })
        }
      })
  )
}

/**
 * Create handler for serving a stable-named JavaScript file (served `no-cache`
 * with an `ETag` — see {@link ENTRY_CACHE_CONTROL}).
 *
 * @param scriptName - Display name for error logging
 * @param scriptPath - File path to JavaScript file
 * @returns Hono route handler function
 */
export function createJavaScriptHandler(
  scriptName: string,
  scriptPath: string | (() => Promise<string>)
) {
  return async (c: Readonly<Context>) => {
    try {
      return stableEntryResponse(
        c.req.raw,
        await readScript(scriptPath),
        ENTRY_CACHE_CONTROL.stable
      )
    } catch (error) {
      logError('[assets] failed to load script', error, { script: scriptName })
      return c.text(`/* ${scriptName} failed to load */`, 500, {
        'Content-Type': 'application/javascript',
      })
    }
  }
}

/**
 * Setup built-in analytics tracking script route
 *
 * Serves dynamically generated analytics tracking script at /assets/analytics.js
 * Template variables are replaced at serve time with app-specific values.
 * Only serves the script when built-in analytics is enabled.
 *
 * @param honoApp - Hono application instance
 * @param app - Application configuration
 * @returns Hono app with analytics script route configured
 */
export function setupAnalyticsScriptRoute(honoApp: Readonly<Hono>, app: App): Readonly<Hono> {
  const analyticsEnabled = app.analytics !== undefined && app.analytics !== false

  if (!analyticsEnabled) return honoApp

  const respectDoNotTrack =
    typeof app.analytics === 'object' ? app.analytics.respectDoNotTrack !== false : true
  const scriptContent = generateTrackingScript(
    '/api/analytics/collect',
    app.name,
    respectDoNotTrack
  )

  return honoApp.get('/assets/analytics.js', (c) => {
    return c.text(scriptContent, 200, {
      'Content-Type': 'application/javascript',
      'Cache-Control': getCacheControlHeader(),
    })
  })
}

/**
 * Setup client runtime bundle route
 *
 * Serves the loader entry at /assets/client.js; {@link setupClientChunkRoutes} serves its chunks.
 *
 * @param honoApp - Hono application instance
 * @returns Hono app with client bundle route configured
 */
export function setupClientBundleRoute(honoApp: Readonly<Hono>): Readonly<Hono> {
  return honoApp.get('/assets/client.js', async (c) => {
    try {
      return stableEntryResponse(c.req.raw, await readClientEntry(), ENTRY_CACHE_CONTROL.stable)
    } catch (error) {
      logError('[assets] failed to build client bundle', error)
      return c.text('/* client bundle build failed */', 500, {
        'Content-Type': 'application/javascript',
      })
    }
  })
}

/**
 * Setup JavaScript asset routes
 *
 * Serves client-side JavaScript files at /assets/*.js
 *
 * @param honoApp - Hono application instance
 * @returns Hono app with JavaScript routes configured
 */
export function setupJavaScriptRoutes(honoApp: Readonly<Hono>): Readonly<Hono> {
  return honoApp
    .get(
      '/assets/language-switcher.js',
      createJavaScriptHandler('language-switcher.js', clientScriptSource('language-switcher.js'))
    )
    .get(
      '/assets/scroll-animation.js',
      createJavaScriptHandler('scroll-animation.js', clientScriptSource('scroll-animation.js'))
    )
}

/**
 * Mount the hashed top-level entry routes (prebuilt modes only).
 *
 * The current names are registered as LITERAL routes as well as through the
 * pattern: static generation (`sovrium build`) only writes literal routes, and
 * a static site whose pages reference `/assets/client-<hash>.js` must contain
 * that file.
 */
export async function setupHashedEntryRoutes(honoApp: Readonly<Hono>): Promise<Readonly<Hono>> {
  if (!servesPrebuiltEntries) return honoApp
  const paths = Object.values(await resolveClientScriptPaths())
  const withCurrent = paths.reduce<Readonly<Hono>>(
    (app, path) =>
      app.get(
        path,
        async (c) =>
          (await serveHashedTopLevelEntry(
            c.req.raw,
            path.slice('/assets/'.length),
            ENTRY_CACHE_CONTROL
          )) ?? c.notFound()
      ),
    honoApp
  )
  return withCurrent.get(
    `/assets/:file{${hashedEntryPattern(Object.keys(HASHED_TOP_LEVEL_ENTRIES))}}`,
    async (c) =>
      (await serveHashedTopLevelEntry(c.req.raw, c.req.param('file'), ENTRY_CACHE_CONTROL)) ??
      c.notFound()
  )
}

/**
 * Setup public directory file serving for development
 *
 * Serves files from a local directory at their relative path.
 * e.g., `publicDir/logos/escp.png` is served at `/logos/escp.png`
 *
 * Hardening (S1 / S4 of the Pre-Launch Security checklist):
 *   1. Realpath the publicDir ONCE at mount time so all comparisons are against
 *      the canonical absolute root. If the directory does not exist at mount,
 *      do NOT register the route — boot stays silent, the framework 404
 *      handler takes any matching request.
 *   2. Per-request: reject any path that matches PUBLIC_DIR_SECRET_BLOCKLIST
 *      with a fall-through to `next()` (→ 404). No log line, no 403, so an
 *      attacker cannot enumerate which secrets exist (anti-enumeration S1).
 *   3. Per-request: resolve the realpath of the joined file path. If the
 *      resolved path does not sit under the publicDir root (symlink escape,
 *      `..` traversal that Hono normalized, etc.), fall through to 404 —
 *      never follow a link out of the bound directory.
 *
 * @param honoApp - Hono application instance
 * @param publicDir - Directory path to serve files from
 * @returns Hono app with public dir route configured (or the same app if the
 *          directory does not exist at mount time)
 */
export async function setupPublicDirRoute(
  honoApp: Readonly<Hono>,
  publicDir: string
): Promise<Readonly<Hono>> {
  // Resolve the canonical absolute root once. If the directory is missing or
  // not a real directory, log debug and skip registration — the framework 404
  // handler picks up any incoming request unchanged.
  const rootRealpath = await realpath(publicDir).catch(() => {
    logDebug('[assets] publicDir not mounted', { publicDir })
    return undefined
  })
  if (rootRealpath === undefined) return honoApp

  // Boundary marker to enforce "under root" check (rules out e.g. `/var/foo`
  // matching `/var/foo-evil`). `path.sep` cross-platform.
  const rootPrefix = rootRealpath + sep

  return honoApp.get('/*', async (c, next) => {
    const { path } = c.req

    // 1) Blocklist match → 404 fall-through. Silent (anti-enumeration).
    if (PUBLIC_DIR_SECRET_BLOCKLIST.test(path)) {
      await next()
      return
    }

    // 2) Symlink-escape guard: resolve the target's realpath and verify it
    // sits under the publicDir root. Any failure (ENOENT, EACCES, broken
    // symlink) falls through to 404 — never propagate.
    const joinedPath = join(rootRealpath, path)
    const targetRealpath = await realpath(joinedPath).catch(() => undefined)
    if (
      targetRealpath === undefined ||
      (targetRealpath !== rootRealpath && !targetRealpath.startsWith(rootPrefix))
    ) {
      await next()
      return
    }

    // 3) Serve the file with an EXPLICIT Content-Type derived from the
    // extension. Deferring to Bun's implicit inference yields
    // `application/octet-stream` for extensionless/unknown files, and — because
    // the platform sets `X-Content-Type-Options: nosniff` — a browser then
    // hard-refuses any such response loaded as a `<script>`/`<link>`
    // ("not a valid JavaScript/CSS MIME type"). `inferMimeFromKey` maps the web
    // static-asset extensions explicitly and only falls back to octet-stream for
    // genuinely-unknown types. These are trusted, app-authored public files, so
    // (unlike untrusted bucket uploads) SVG is served inline with its real type;
    // the upload path's attachment/CSP gate is intentionally NOT applied here.
    const file = Bun.file(targetRealpath)
    if (await file.exists()) {
      return new Response(file, {
        headers: {
          'Content-Type': inferMimeFromKey(targetRealpath),
          'Cache-Control': getCacheControlHeader(),
        },
      })
    }

    await next()
  })
}

/**
 * Mount the static asset routes: CSS, JavaScript, islands, and optionally a public directory.
 *
 * The page-search index (`/sovrium-search/*`) is served from the data
 * directory the boot wrote it into (`searchIndexDir`), mounted BEFORE the
 * app's own `public/` folder so a stale copy an older version left there can
 * never shadow the current index. That directory holds nothing but
 * `sovrium-search/`, so mounting it exposes nothing else of the data dir.
 *
 * @param honoApp - Hono application instance
 * @param app - Application configuration
 * @param publicDir - Optional directory to serve static files from
 * @returns Hono app with static asset routes configured
 */
export async function setupStaticAssets(
  honoApp: Readonly<Hono>,
  app: App,
  publicDir?: string
): Promise<Readonly<Hono>> {
  const withHashed = await setupHashedEntryRoutes(
    setupClientBundleRoute(setupJavaScriptRoutes(setupCSSRoute(honoApp, app)))
  )
  const withEntries = await setupClientChunkRoutes(withHashed, assetCacheControl)
  const withAssets = setupBrandMarkRoute(
    setupDesignSystemSampleRoute(setupIslandRoutes(setupAnalyticsScriptRoute(withEntries, app)))
  )
  // `setupPublicDirRoute` is async because it realpath()s the directory once
  // at mount time (security hardening — see its docstring). If the directory
  // does not exist, the helper returns `withAssets` unchanged so the framework
  // 404 handler picks up matching requests; no behavioral regression vs. the
  // sync past.
  const withSearch = hasPageSearchComponent(app)
    ? await setupPublicDirRoute(withAssets, searchIndexDir())
    : withAssets
  return publicDir ? setupPublicDirRoute(withSearch, publicDir) : withSearch
}
