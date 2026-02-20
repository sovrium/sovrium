/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Console, Effect } from 'effect'
import { type Context, type Hono } from 'hono'
import { compileCSS } from '@/infrastructure/css/compiler'
import type { App } from '@/domain/models/app'

/**
 * Cache duration for static assets (CSS, JS) in seconds (1 hour)
 */
const STATIC_ASSET_CACHE_DURATION_SECONDS = 3600

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
      const result = await Effect.runPromise(
        compileCSS(app).pipe(Effect.tap(() => Console.log('CSS compiled successfully')))
      )

      return c.text(result.css, 200, {
        'Content-Type': 'text/css',
        'Cache-Control': `public, max-age=${STATIC_ASSET_CACHE_DURATION_SECONDS}`,
      })
    } catch (error) {
      // Log error - intentional side effect for error tracking
      // eslint-disable-next-line functional/no-expression-statements
      await Effect.runPromise(Console.error('CSS compilation failed:', error))
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
        'Cache-Control': `public, max-age=${STATIC_ASSET_CACHE_DURATION_SECONDS}`,
      })
    } catch (error) {
      // eslint-disable-next-line functional/no-expression-statements
      await Effect.runPromise(Console.error(`Failed to load ${scriptName}:`, error))
      return c.text(`/* ${scriptName} failed to load */`, 500, {
        'Content-Type': 'application/javascript',
      })
    }
  }
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
      createJavaScriptHandler(
        'language-switcher.js',
        './src/presentation/scripts/client/language-switcher.js'
      )
    )
    .get(
      '/assets/banner-dismiss.js',
      createJavaScriptHandler(
        'banner-dismiss.js',
        './src/presentation/scripts/client/banner-dismiss.js'
      )
    )
    .get(
      '/assets/scroll-animation.js',
      createJavaScriptHandler(
        'scroll-animation.js',
        './src/presentation/scripts/client/scroll-animation.js'
      )
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
          'Cache-Control': `public, max-age=${STATIC_ASSET_CACHE_DURATION_SECONDS}`,
        },
      })
    }

    // eslint-disable-next-line functional/no-expression-statements
    await next()
  })
}

/**
 * Setup static asset routes (CSS, JavaScript, and optional public directory)
 *
 * Mounts CSS, JavaScript, and optionally public directory asset routes
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
  const withAssets = setupJavaScriptRoutes(setupCSSRoute(honoApp, app))
  return publicDir ? setupPublicDirRoute(withAssets, publicDir) : withAssets
}
