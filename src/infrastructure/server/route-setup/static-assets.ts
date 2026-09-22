/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { readdir, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, sep } from 'node:path'
import { Effect } from 'effect'
import { type Context, type Hono } from 'hono'
import { inferMimeFromKey } from '@/domain/kernel/identity/mime-types'
import { generateTrackingScript } from '@/infrastructure/analytics/tracking-script'
import { codemirrorDedupePlugin } from '@/infrastructure/assets/codemirror-dedupe-plugin'
import { getRuntimeAssets } from '@/infrastructure/assets/embedded-runtime-assets'
import {
  readEmbeddedBrandMark,
  readEmbeddedSample,
  type EmbeddedAsset,
} from '@/infrastructure/assets/embedded-static-assets'
import {
  computeIslandPreloadManifest,
  type IslandChunkReader,
  type IslandPreloadManifest,
} from '@/infrastructure/assets/island-preload-manifest'
import { compileCSS } from '@/infrastructure/css/compiler'
import {
  consoleCssHash,
  getVersionedCssHash,
  parseVersionedCssHash,
  VERSIONED_CSS_FILE_PATTERN,
} from '@/infrastructure/css/versioned-css-path'
import { logError, logDebug } from '@/infrastructure/logging/logger'
import { isDevCacheDisabled, isProduction as isProductionEnv } from '@/infrastructure/process/env'
import {
  clientScriptPath,
  isBundled,
  isCompiled,
  resolvePackagePath,
} from '@/infrastructure/process/package-paths'
import { adminMountsFor, scopedAppForMount } from '../admin-mounts'
import { islandDirName, sweepStaleIslandDirs } from './island-dir-sweep'
import type { App } from '@/domain/models/app'

const isProduction = isProductionEnv()

/**
 * Build Cache-Control header value for static assets.
 *
 * Production: 1-hour public cache for performance.
 * Development: no caching so asset changes are immediately visible.
 */
export function getCacheControlHeader(): string {
  return isProduction ? 'public, max-age=3600' : 'no-store, no-cache, must-revalidate'
}

/**
 * Resolve WHICH app a versioned stylesheet request is asking for.
 *
 * The server hosts two apps, not one: the operator's, and Sovrium's own
 * `/_admin` console (a separate embedded config). Each links its own hash, so
 * the hash is the request's statement of which stylesheet it wants.
 *
 * That USED to be described here as the reason a tenant theme stopped at the
 * tenant's pages. It is not, and has not been since the operator's `design`
 * began cascading onto the console chrome: the two stylesheets now
 * carry the SAME operator tokens, and differ because the console's is compiled
 * from the console's own pages, its own single-zone map, its own preset
 * classes, and the scoped design-system layer no operator page carries. So the
 * hash still selects genuinely different content — it just no longer selects
 * between "themed" and "unthemed".
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
 * Create handler for serving JavaScript file
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
      const path = typeof scriptPath === 'function' ? await scriptPath() : scriptPath
      const file = Bun.file(path)
      const content = await file.text()

      return c.text(content, 200, {
        'Content-Type': 'application/javascript',
        'Cache-Control': getCacheControlHeader(),
      })
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
 * Wrap an asset `build` step in promise-memoization that is bypassed in dev.
 *
 * Prebuilt-asset modes (compiled binary, npm bundle) and normal dev runs share
 * the same cache. Only a live-edit dev run (`isDevCacheDisabled()`) re-runs
 * `build` on every call so source edits appear without a restart. The
 * `!isCompiled && !isBundled` guard keeps prebuilt assets memoized even when the
 * dev-cache flag is set, since there is no source to rebuild from in those modes.
 *
 * Both bundle providers below (`getClientBundle`, `buildIslands`) share this
 * exact dev-bypass/memo idiom; centralizing it keeps the dev-cache condition in
 * one place and removes the per-provider mutable `cachedPromise`.
 */
const memoizeUnlessDev = <T>(build: () => Promise<T>): (() => Promise<T>) => {
  // eslint-disable-next-line functional/no-let
  let cachedPromise: Promise<T> | undefined
  return (): Promise<T> => {
    if (!isCompiled && !isBundled && isDevCacheDisabled()) return build()
    return (cachedPromise ??= build())
  }
}

/**
 * Creates a lazy-cached client bundle provider.
 *
 * In development: builds src/presentation/islands/client.ts at runtime via Bun.build()
 * In bundled mode (npm package): reads pre-built dist/client-bundle.js
 *
 * The result is cached via promise memoization (bypassed on dev live-edit runs).
 */
const getClientBundle = (() => {
  const build = async (): Promise<string> => {
    // In the compiled binary, serve the embedded pre-built client bundle.
    if (isCompiled) {
      const assets = await getRuntimeAssets()
      return Bun.file(assets.clientBundle).text()
    }

    // In bundled mode, serve the pre-built client bundle from dist/
    if (isBundled) {
      return Bun.file(resolvePackagePath('dist', 'client-bundle.js')).text()
    }

    // In development, build from source at runtime
    const entrypoint = resolvePackagePath('src', 'presentation', 'islands', 'client.ts')
    const result = await Bun.build({
      entrypoints: [entrypoint],
      target: 'browser',
      minify: isProduction,
      format: 'esm',
    })

    if (!result.success) {
      const errors = result.logs.map((log) => log.message).join('\n')
      // eslint-disable-next-line functional/no-throw-statements
      throw new Error(`Client bundle build failed:\n${errors}`)
    }

    const output = result.outputs[0]
    if (!output) {
      // eslint-disable-next-line functional/no-throw-statements
      throw new Error('Client bundle build produced no output')
    }

    return output.text()
  }

  return memoizeUnlessDev(build)
})()

/**
 * Setup client runtime bundle route
 *
 * Serves the bundled client-side runtime at /assets/client.js
 * The bundle is built from src/presentation/islands/client.ts using Bun.build()
 * and cached in memory.
 *
 * @param honoApp - Hono application instance
 * @returns Hono app with client bundle route configured
 */
export function setupClientBundleRoute(honoApp: Readonly<Hono>): Readonly<Hono> {
  return honoApp.get('/assets/client.js', async (c) => {
    try {
      const bundle = await getClientBundle()
      return c.text(bundle, 200, {
        'Content-Type': 'application/javascript',
        'Cache-Control': getCacheControlHeader(),
      })
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
/**
 * Resolve a client-script source: the embedded copy in the compiled binary,
 * else the on-disk path (dist/ when bundled, src/ in dev).
 */
const clientScriptSource = (name: string): string | (() => Promise<string>) =>
  isCompiled
    ? () => getRuntimeAssets().then((a) => a.clientScripts[name] as string)
    : clientScriptPath(name)

export function setupJavaScriptRoutes(honoApp: Readonly<Hono>): Readonly<Hono> {
  return honoApp
    .get(
      '/assets/language-switcher.js',
      createJavaScriptHandler('language-switcher.js', clientScriptSource('language-switcher.js'))
    )
    .get(
      '/assets/banner-dismiss.js',
      createJavaScriptHandler('banner-dismiss.js', clientScriptSource('banner-dismiss.js'))
    )
    .get(
      '/assets/scroll-animation.js',
      createJavaScriptHandler('scroll-animation.js', clientScriptSource('scroll-animation.js'))
    )
}

/**
 * Pattern matching the well-known secret / dev-artifact file shapes that must
 * never be served by the public-directory route, even if the operator
 * accidentally placed them under publicDir. Matched against the URL path
 * (case-insensitive). Returns 404 (NOT 403) on match — per S1 anti-enumeration,
 * an attacker probing for `.env.production` must NOT learn whether the file
 * exists from a 403-vs-404 distinction.
 *
 * Covered shapes (each as a separate alternation):
 *  - `.env` / `.env.local` / `.env.production` / `.env.<anything>` at any depth
 *  - `.git/**` (any git internals)
 *  - `node_modules/**` (package manager directory)
 *  - `.sovrium/**` (runtime data dir — SQLite db, lock file, local uploads)
 *  - `CLAUDE.md` (LLM operator instructions — may contain secrets / IPs)
 *  - `*.key` / `*.pem` (SSH / TLS private material)
 *  - `*.sql` / `*.sqlite` / `*.sqlite-journal` (database dumps + SQLite files)
 *
 * The leading group `(?:^|\/)` anchors each pattern to a path-segment boundary
 * so `legitimate-app.key.png` is NOT mistaken for a private key.
 */
const PUBLIC_DIR_SECRET_BLOCKLIST =
  /(?:^|\/)(?:\.env(?:\..+)?|\.git\/.*|node_modules\/.*|\.sovrium\/.*|CLAUDE\.md|[^/]+\.(?:key|pem|sql|sqlite(?:-journal)?))$/i

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

// ---------------------------------------------------------------------------
// Island bundle (React islands with code splitting)
// ---------------------------------------------------------------------------

/**
 * Directory where island build outputs are stored.
 *
 * Development: a PER-PROCESS tmpdir, built at runtime via Bun.build
 * Bundled:     dist/island-chunks (pre-built during npm publish)
 *
 * The dev path is keyed by pid because several Sovrium servers routinely run at
 * once — Playwright boots one per worker — and `Bun.build` writes each output by
 * truncating the target file and then rewriting it. That is not atomic. With a
 * single shared directory, content-hashed names make every process write the
 * same bytes to the same path, so the builds look interchangeable; but a GET
 * landing between another process's truncate and its rewrite still serves a
 * half-written module. The browser then throws a SyntaxError, no island mounts,
 * and a page built only from islands renders as an empty skeleton with nothing
 * in the server log to show for it (`/assets/` is excluded from the logger).
 * Under `isDevCacheDisabled()` the exposure is at its worst: `memoizeUnlessDev`
 * stops memoizing, so all 126 outputs are rewritten on EVERY request rather than
 * once per process.
 *
 * Giving each process its own directory removes the sharing outright, rather
 * than merely narrowing the window as renaming a temporary file into place
 * would. Nothing reads these files across processes: the server that builds
 * them is the one that serves them.
 *
 * These directories outlive the process that made them, so `island-dir-sweep`
 * reclaims abandoned ones — it owns the naming for exactly that reason.
 */
const ISLAND_OUT_DIR = isBundled
  ? resolvePackagePath('dist', 'island-chunks')
  : join(tmpdir(), islandDirName(process.pid))

/**
 * Island bundle build result
 */
export interface IslandBuildResult {
  /** Relative path of the entry file (e.g., "island-client-a7f3b2.js" or "island-entry.js") */
  readonly entryFile: string
  /**
   * Island type -> the chunk paths a page mounting it must already have when the
   * entry evaluates, so the document can declare them as `modulepreload`.
   *
   * An empty map is a valid answer (nothing resolved, or nothing left after
   * subtracting the entry's own closure) and degrades to the pre-2026-09-02
   * behaviour. See `@/infrastructure/assets/island-preload-manifest`.
   */
  readonly preloads: IslandPreloadManifest
}

/**
 * Reader over an on-disk island build directory — the dev per-process tmpdir
 * and the bundled `dist/island-chunks`, which differ only in path.
 *
 * `recursive` is load-bearing: the dev build emits the entry at the root and
 * every chunk under `chunks/`, so a flat listing would find nothing to preload
 * and return an empty manifest that looks like a legitimate "nothing to do".
 */
function diskChunkReader(root: string): IslandChunkReader {
  return {
    list: async () => {
      const names = await readdir(root, { recursive: true }).catch(() => [] as string[])
      return names.map((name) => name.split(sep).join('/')).filter((name) => name.endsWith('.js'))
    },
    read: (relativePath) => Bun.file(join(root, relativePath)).text(),
  }
}

/** Reader over the compiled binary's embedded island assets. */
async function embeddedChunkReader(): Promise<IslandChunkReader> {
  const assets = await getRuntimeAssets()
  return {
    list: async () => Object.keys(assets.islands).filter((name) => name.endsWith('.js')),
    read: (relativePath) => {
      const embedded = assets.islands[relativePath]
      return embedded === undefined
        ? Promise.reject(new Error(`No embedded island chunk "${relativePath}"`))
        : Bun.file(embedded).text()
    },
  }
}

/**
 * Provides the island client bundle.
 *
 * In development: builds from source at runtime via Bun.build with code splitting.
 * In bundled mode: returns the pre-built entry from dist/island-chunks/island-entry.js.
 *
 * Result is memoized for the process lifetime (bypassed on dev live-edit runs;
 * see `memoizeUnlessDev`).
 */
export const buildIslands = (() => {
  // eslint-disable-next-line functional/no-let
  let sweepStarted = false

  const build = async (): Promise<IslandBuildResult> => {
    // Compiled binary (embedded) and bundled mode (dist/) both ship a
    // pre-built island entry under the stable name `island-entry.js`.
    // Neither builds into tmpdir, so neither has anything to sweep — the
    // early return keeps the sweep out of those paths entirely.
    if (isCompiled || isBundled) {
      logDebug('[ISLANDS] Using pre-built island entry')
      const reader = isCompiled ? await embeddedChunkReader() : diskChunkReader(ISLAND_OUT_DIR)
      const preloads = await computeIslandPreloadManifest(reader, 'island-entry.js')
      return { entryFile: 'island-entry.js', preloads }
    }

    // Reclaim the build directories of servers that have since exited. Started
    // at most once per process — under `isDevCacheDisabled()` this function runs
    // on EVERY request — and deliberately not awaited: it is housekeeping, so it
    // must never delay the first response, and `sweepStaleIslandDirs` never
    // throws, so it can never keep a server from starting.
    if (!sweepStarted) {
      // eslint-disable-next-line functional/no-expression-statements
      sweepStarted = true
      // eslint-disable-next-line functional/no-expression-statements
      void sweepStaleIslandDirs()
        .then((removed) => {
          if (removed.length > 0) {
            logDebug(`[ISLANDS] Reclaimed ${removed.length} abandoned build dir(s)`)
          }
        })
        .catch((error: unknown) => logDebug(`[ISLANDS] Sweep skipped: ${String(error)}`))
    }

    // In development, build from source at runtime
    const entrypoint = resolvePackagePath('src', 'presentation', 'islands', 'island-client.tsx')

    const result = await Bun.build({
      entrypoints: [entrypoint],
      outdir: ISLAND_OUT_DIR,
      target: 'browser',
      format: 'esm',
      splitting: true,
      minify: isProduction,
      // Force a single @codemirror/@lezer instance across the island bundle;
      // duplicate copies otherwise crash the CodeMirror editor on mount.
      plugins: [codemirrorDedupePlugin],
      naming: {
        entry: '[name]-[hash].js',
        chunk: 'chunks/[name]-[hash].js',
      },
    })

    if (!result.success) {
      const errors = result.logs.map((log) => log.message).join('\n')
      // eslint-disable-next-line functional/no-throw-statements
      throw new Error(`Island bundle build failed:\n${errors}`)
    }

    const entry = result.outputs.find((o) => o.kind === 'entry-point')
    if (!entry) {
      // eslint-disable-next-line functional/no-throw-statements
      throw new Error('Island bundle build produced no entry-point output')
    }

    // Extract relative filename from absolute path
    const entryFile = entry.path.replace(ISLAND_OUT_DIR + '/', '')
    logDebug(`[ISLANDS] Built entry: ${entryFile} (${result.outputs.length} outputs)`)

    const preloads = await computeIslandPreloadManifest(diskChunkReader(ISLAND_OUT_DIR), entryFile)

    return { entryFile, preloads }
  }

  return memoizeUnlessDev(build)
})()

/**
 * Setup island bundle routes
 *
 * Serves the island entry point and chunk files at /assets/islands/*
 * Chunks are produced by Bun.build splitting and loaded on demand.
 *
 * @param honoApp - Hono application instance
 * @returns Hono app with island routes configured
 */
/**
 * Inert JS stub for zero-length chunk files: a Response over a zero-length
 * Bun.file collapses to a bodiless 204, which browsers reject as an ES module
 * (aborting island-entry.js evaluation and all hydration with it).
 */
function emptyChunkStub(): Response {
  return new Response('/* empty island chunk */', {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': getCacheControlHeader(),
    },
  })
}

/** Content-hashed chunk names (`accordion-island-1a2b3c4d.js`) — safe to pin. */
const CONTENT_HASHED_ASSET = /-[a-z0-9]{8}\.js$/
const isContentHashed = (name: string): boolean => CONTENT_HASHED_ASSET.test(name)

/**
 * `immutable` only for content-hashed names (the name changes when the content
 * does). Stable names like `island-entry.js` change content across releases
 * under a fixed URL, so they get the short cache — else a returning visitor can
 * pin an outdated entry that references chunks 404ing in the new deploy.
 */
function assetCacheControl(name: string): string {
  return isProduction && isContentHashed(name)
    ? 'public, max-age=31536000, immutable'
    : getCacheControlHeader()
}

export function setupIslandRoutes(honoApp: Readonly<Hono>): Readonly<Hono> {
  return honoApp.get('/assets/islands/*', async (c) => {
    try {
      const relativePath = c.req.path.replace('/assets/islands/', '')

      // Compiled binary: serve the embedded chunk by name.
      if (isCompiled) {
        const assets = await getRuntimeAssets()
        const embeddedPath = assets.islands[relativePath]
        if (embeddedPath === undefined) return c.notFound()
        const embedded = Bun.file(embeddedPath)
        if (embedded.size === 0) return emptyChunkStub()
        return new Response(embedded, {
          headers: {
            'Content-Type': 'application/javascript',
            'Cache-Control': assetCacheControl(relativePath),
          },
        })
      }

      const filePath = join(ISLAND_OUT_DIR, relativePath)
      const file = Bun.file(filePath)

      if (await file.exists()) {
        if (file.size === 0) return emptyChunkStub()
        return new Response(file, {
          headers: {
            'Content-Type': 'application/javascript',
            'Cache-Control': assetCacheControl(relativePath),
          },
        })
      }

      return c.notFound()
    } catch (error) {
      logError('[ISLANDS] Failed to serve island chunk', error)
      return c.text('/* island chunk not found */', 404, {
        'Content-Type': 'application/javascript',
      })
    }
  })
}

/** Route prefix the design-system console's media specimens link. */
const DESIGN_SYSTEM_SAMPLE_PREFIX = '/assets/design-system/'

/**
 * Build a `GET`/`HEAD` route serving one embedded asset family off `prefix`.
 *
 * THE LOOKUP KEY IS THE WHOLE REMAINDER of the path, never its last segment,
 * and the family's reader is a property read on a frozen map. Together those
 * two facts are what make this fail CLOSED: there is no path join anywhere in
 * the handler, so a nested or traversing spelling (`../../.env`,
 * `nested/sample-still.avif`) is an ordinary miss answering 404 rather than a
 * read that has to be defended against. A key the family does not hold is the
 * same miss, which is how files deliberately left out of a family — the
 * live-text brand marks, say — stay unreachable rather than merely unused.
 *
 * `GET` and `HEAD`, because a reader weighing an asset should not have to
 * download it to learn its size; `Content-Length` is explicit so the HEAD
 * answer carries it with no body to derive it from.
 *
 * Shared by both families rather than written twice, so the two cannot drift
 * apart on the property that matters — an asset route that started answering
 * 500 on an unknown key, or resolving one, would be a security regression in
 * whichever copy was edited second.
 */
const embeddedAssetRoute =
  (prefix: string, read: (key: string) => Promise<EmbeddedAsset | undefined>) =>
  (honoApp: Readonly<Hono>): Readonly<Hono> =>
    honoApp.on(['GET', 'HEAD'], `${prefix}*`, async (c) => {
      const asset = await read(c.req.path.slice(prefix.length))
      if (asset === undefined) return c.notFound()
      return new Response(asset.bytes, {
        headers: {
          'Content-Type': asset.contentType,
          'Content-Length': String(asset.bytes.byteLength),
          'Cache-Control': getCacheControlHeader(),
        },
      })
    })

/**
 * Serve the design-system console's sample media at `/assets/design-system/*`.
 *
 * The console's `audio`, `video` and `image` specimens draw a real file rather
 * than an empty transport or a `data:` rectangle, and these are the three
 * bytes-on-the-wire that make that true. They are embedded in the binary, so
 * this route answers identically from a checkout and from a compiled
 * executable — see `readEmbeddedSample`.
 *
 * MOUNTED AT THE ROOT, NOT UNDER `/_admin`, and that is load-bearing rather
 * than incidental: the admin mount serves PAGE routes only, so a console page
 * reaches every asset — its own stylesheet included — by absolute root path.
 * A sample served under the mount would 404 for exactly the reader it exists
 * for.
 *
 * Fail-closed lookup and the GET/HEAD contract come from
 * {@link embeddedAssetRoute}, which both asset families share.
 */
export const setupDesignSystemSampleRoute = embeddedAssetRoute(
  DESIGN_SYSTEM_SAMPLE_PREFIX,
  readEmbeddedSample
)

/** Route prefix the console's own brand mark is served from. */
const BRAND_MARK_PREFIX = '/assets/brand/'

/**
 * Serve Sovrium's own brand marks at `/assets/brand/<unit>/<file>`.
 *
 * WHY THE ENGINE HAS TO SERVE THESE AT ALL. `design.logo` resolves its `src`
 * against the HOSTING app's `public/` directory, and the operator console is
 * mounted inside somebody else's app — so a config path to a Sovrium asset
 * resolves into Acme's `public/` and 404s in every real deployment. The `icon`
 * component-type renders lucide nodes only, and this mark is not one. Embedding
 * the bytes is what lets the console look like itself on a machine with no
 * network, no CDN, and no cooperation from the app hosting it.
 *
 * MOUNTED AT THE ROOT, NOT UNDER `/_admin`, for the same load-bearing reason
 * {@link setupDesignSystemSampleRoute} is: the admin mount serves PAGE routes
 * only, so a console page reaches every asset by absolute root path, and a mark
 * served under the mount would 404 for exactly the page it exists for. The
 * console's sign-in card therefore names the absolute path deliberately, where
 * every other link on that page is mount-relative.
 *
 * The shared lookup key is the WHOLE remainder of the path — here `<unit>/<file>`,
 * because all four business units hold marks of the same filename and the
 * directory is what distinguishes them. Names outside the family miss like any
 * other, the live-text `mark-light.svg` among them: it is excluded on purpose,
 * since an `<img>`-loaded SVG reaches no webfont and would draw the mark in a
 * fallback typeface.
 */
export const setupBrandMarkRoute = embeddedAssetRoute(BRAND_MARK_PREFIX, readEmbeddedBrandMark)

/**
 * Setup static asset routes (CSS, JavaScript, islands, and optional public directory)
 *
 * Mounts CSS, JavaScript, island, and optionally public directory asset routes
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
  const withAssets = setupBrandMarkRoute(
    setupDesignSystemSampleRoute(
      setupIslandRoutes(
        setupAnalyticsScriptRoute(
          setupClientBundleRoute(setupJavaScriptRoutes(setupCSSRoute(honoApp, app))),
          app
        )
      )
    )
  )
  // `setupPublicDirRoute` is async because it realpath()s the directory once
  // at mount time (security hardening — see its docstring). If the directory
  // does not exist, the helper returns `withAssets` unchanged so the framework
  // 404 handler picks up matching requests; no behavioral regression vs. the
  // sync past.
  return publicDir ? setupPublicDirRoute(withAssets, publicDir) : withAssets
}
