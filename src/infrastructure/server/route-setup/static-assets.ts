/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Effect } from 'effect'
import { type Context, type Hono } from 'hono'
import { generateTrackingScript } from '@/infrastructure/analytics/tracking-script'
import { compileCSS } from '@/infrastructure/css/compiler'
import { logError, logDebug } from '@/infrastructure/logging/logger'
import { isProduction as isProductionEnv } from '@/infrastructure/utils/env'
import {
  clientScriptPath,
  isBundled,
  resolvePackagePath,
} from '@/infrastructure/utils/package-paths'
import type { App } from '@/domain/models/app'

const isProduction = isProductionEnv()

export function getCacheControlHeader(): string {
  return isProduction ? 'public, max-age=3600' : 'no-store, no-cache, must-revalidate'
}

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

const getClientBundle = (() => {
  let cachedPromise: Promise<string> | undefined

  return (): Promise<string> => {
    if (cachedPromise) return cachedPromise

    cachedPromise = (async () => {
      if (isBundled) {
        return Bun.file(resolvePackagePath('dist', 'client-bundle.js')).text()
      }

      const entrypoint = resolvePackagePath('src', 'presentation', 'client.ts')
      const result = await Bun.build({
        entrypoints: [entrypoint],
        target: 'browser',
        minify: isProduction,
        format: 'esm',
      })

      if (!result.success) {
        const errors = result.logs.map((log) => log.message).join('\n')
        throw new Error(`Client bundle build failed:\n${errors}`)
      }

      const output = result.outputs[0]
      if (!output) {
        throw new Error('Client bundle build produced no output')
      }

      return output.text()
    })()

    return cachedPromise
  }
})()

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

    await next()
  })
}


const ISLAND_OUT_DIR = isBundled
  ? resolvePackagePath('dist', 'island-chunks')
  : join(tmpdir(), 'sovrium-islands')

export interface IslandBuildResult {
  readonly entryFile: string
}

export const buildIslands = (() => {
  let cachedPromise: Promise<IslandBuildResult> | undefined

  return (): Promise<IslandBuildResult> => {
    if (cachedPromise) return cachedPromise

    cachedPromise = (async () => {
      if (isBundled) {
        logDebug('[ISLANDS] Using pre-built island entry from dist/')
        return { entryFile: 'island-entry.js' }
      }

      const entrypoint = resolvePackagePath('src', 'presentation', 'islands', 'island-client.tsx')

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
        throw new Error(`Island bundle build failed:\n${errors}`)
      }

      const entry = result.outputs.find((o) => o.kind === 'entry-point')
      if (!entry) {
        throw new Error('Island bundle build produced no entry-point output')
      }

      const entryFile = entry.path.replace(ISLAND_OUT_DIR + '/', '')
      logDebug(`[ISLANDS] Built entry: ${entryFile} (${result.outputs.length} outputs)`)

      return { entryFile }
    })()

    return cachedPromise
  }
})()

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
