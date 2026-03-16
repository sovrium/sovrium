/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { Effect } from 'effect'
import { type Context, type Hono } from 'hono'
import { generateTrackingScript } from '@/infrastructure/analytics/tracking-script'
import { compileCSS } from '@/infrastructure/css/compiler'
import { logError, logDebug } from '@/infrastructure/logging/logger'
import { clientScriptPath, SOVRIUM_PACKAGE_ROOT } from '@/infrastructure/utils/package-paths'
import type { App } from '@/domain/models/app'

const isProduction = process.env.NODE_ENV === 'production'

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
 * Setup CSS compilation route
 *
 * Serves dynamically compiled CSS with theme tokens at /assets/output.css
 *
 * @param honoApp - Hono application instance
 * @param app - Application configuration
 * @returns Hono app with CSS route configured
 */
export function setupCSSRoute(honoApp: Readonly<Hono>, app: App): Readonly<Hono> {
  return honoApp.get('/assets/output.css', async (c) => {
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
}

/**
 * Create handler for serving JavaScript file
 *
 * @param scriptName - Display name for error logging
 * @param scriptPath - File path to JavaScript file
 * @returns Hono route handler function
 */
export function createJavaScriptHandler(scriptName: string, scriptPath: string) {
  return async (c: Readonly<Context>) => {
    try {
      const file = Bun.file(scriptPath)
      const content = await file.text()

      return c.text(content, 200, {
        'Content-Type': 'application/javascript',
        'Cache-Control': getCacheControlHeader(),
      })
    } catch (error) {
      logError(`[ASSETS] Failed to load ${scriptName}`, error)
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
 * Creates a lazy-cached client bundle builder using Bun.build()
 *
 * The client entry point (src/presentation/client.ts) is bundled into a single
 * self-contained JavaScript file for browser consumption. The result is cached
 * via promise memoization to avoid rebuilding on every request.
 */
const getClientBundle = (() => {
  // eslint-disable-next-line functional/no-let
  let cachedPromise: Promise<string> | undefined

  return (): Promise<string> => {
    if (cachedPromise) return cachedPromise

    cachedPromise = (async () => {
      const entrypoint = resolve(SOVRIUM_PACKAGE_ROOT, 'src', 'presentation', 'client.ts')
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
    })()

    return cachedPromise
  }
})()

/**
 * Setup client runtime bundle route
 *
 * Serves the bundled client-side runtime at /assets/client.js
 * The bundle is built from src/presentation/client.ts using Bun.build()
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
      logError('[ASSETS] Failed to build client bundle', error)
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
      createJavaScriptHandler('language-switcher.js', clientScriptPath('language-switcher.js'))
    )
    .get(
      '/assets/banner-dismiss.js',
      createJavaScriptHandler('banner-dismiss.js', clientScriptPath('banner-dismiss.js'))
    )
    .get(
      '/assets/scroll-animation.js',
      createJavaScriptHandler('scroll-animation.js', clientScriptPath('scroll-animation.js'))
    )
}

/**
 * Setup public directory file serving for development
 *
 * Serves files from a local directory at their relative path.
 * e.g., `publicDir/logos/escp.png` is served at `/logos/escp.png`
 *
 * @param honoApp - Hono application instance
 * @param publicDir - Directory path to serve files from
 * @returns Hono app with public dir route configured
 */
export function setupPublicDirRoute(honoApp: Readonly<Hono>, publicDir: string): Readonly<Hono> {
  return honoApp.get('/*', async (c, next) => {
    const { path } = c.req
    const filePath = `${publicDir}${path}`
    const file = Bun.file(filePath)

    if (await file.exists()) {
      return new Response(file, {
        headers: {
          'Cache-Control': getCacheControlHeader(),
        },
      })
    }

    // eslint-disable-next-line functional/no-expression-statements
    await next()
  })
}

// ---------------------------------------------------------------------------
// Island bundle (React islands with code splitting)
// ---------------------------------------------------------------------------

const ISLAND_OUT_DIR = join(tmpdir(), 'sovrium-islands')

/**
 * Island bundle build result
 */
export interface IslandBuildResult {
  /** Relative path of the entry file (e.g., "island-client-a7f3b2.js") */
  readonly entryFile: string
}

/**
 * Builds the island client bundle with code splitting.
 *
 * Uses Bun.build with `splitting: true` to extract React, TanStack Query,
 * and TanStack Table into separate chunks. The entry point discovers
 * [data-island] markers in the DOM and mounts React roots.
 *
 * Build output is written to a temp directory and cached for the process lifetime.
 */
export const buildIslands = (() => {
  // eslint-disable-next-line functional/no-let
  let cachedPromise: Promise<IslandBuildResult> | undefined

  return (): Promise<IslandBuildResult> => {
    if (cachedPromise) return cachedPromise

    cachedPromise = (async () => {
      const entrypoint = resolve(
        SOVRIUM_PACKAGE_ROOT,
        'src',
        'presentation',
        'islands',
        'island-client.tsx'
      )

      const result = await Bun.build({
        entrypoints: [entrypoint],
        outdir: ISLAND_OUT_DIR,
        target: 'browser',
        format: 'esm',
        splitting: true,
        minify: isProduction,
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

      return { entryFile }
    })()

    return cachedPromise
  }
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
export function setupIslandRoutes(honoApp: Readonly<Hono>): Readonly<Hono> {
  return honoApp.get('/assets/islands/*', async (c) => {
    try {
      const relativePath = c.req.path.replace('/assets/islands/', '')
      const filePath = join(ISLAND_OUT_DIR, relativePath)
      const file = Bun.file(filePath)

      if (await file.exists()) {
        return new Response(file, {
          headers: {
            'Content-Type': 'application/javascript',
            'Cache-Control': isProduction
              ? 'public, max-age=31536000, immutable'
              : getCacheControlHeader(),
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
export function setupStaticAssets(
  honoApp: Readonly<Hono>,
  app: App,
  publicDir?: string
): Readonly<Hono> {
  const withAssets = setupIslandRoutes(
    setupAnalyticsScriptRoute(
      setupClientBundleRoute(setupJavaScriptRoutes(setupCSSRoute(honoApp, app))),
      app
    )
  )
  return publicDir ? setupPublicDirRoute(withAssets, publicDir) : withAssets
}
