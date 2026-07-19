/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, sep } from 'node:path'
import { Effect } from 'effect'
import { type Context, type Hono } from 'hono'
import { inferMimeFromKey } from '@/domain/utils/mime-types'
import { generateTrackingScript } from '@/infrastructure/analytics/tracking-script'
import { codemirrorDedupePlugin } from '@/infrastructure/assets/codemirror-dedupe-plugin'
import { getRuntimeAssets } from '@/infrastructure/assets/embedded-runtime-assets'
import { compileCSS } from '@/infrastructure/css/compiler'
import { logError, logDebug } from '@/infrastructure/logging/logger'
import { isDevCacheDisabled, isProduction as isProductionEnv } from '@/infrastructure/utils/env'
import {
  clientScriptPath,
  isBundled,
  isCompiled,
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

const memoizeUnlessDev = <T>(build: () => Promise<T>): (() => Promise<T>) => {
  let cachedPromise: Promise<T> | undefined
  return (): Promise<T> => {
    if (!isCompiled && !isBundled && isDevCacheDisabled()) return build()
    return (cachedPromise ??= build())
  }
}

const getClientBundle = (() => {
  const build = async (): Promise<string> => {
    if (isCompiled) {
      const assets = await getRuntimeAssets()
      return Bun.file(assets.clientBundle).text()
    }

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
  }

  return memoizeUnlessDev(build)
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

const PUBLIC_DIR_SECRET_BLOCKLIST =
  /(?:^|\/)(?:\.env(?:\..+)?|\.git\/.*|node_modules\/.*|\.sovrium\/.*|CLAUDE\.md|[^/]+\.(?:key|pem|sql|sqlite(?:-journal)?))$/i

export async function setupPublicDirRoute(
  honoApp: Readonly<Hono>,
  publicDir: string
): Promise<Readonly<Hono>> {
  const rootRealpath = await realpath(publicDir).catch((error: unknown) => {
    logDebug(`[ASSETS] publicDir not mounted: ${publicDir} (${String(error)})`)
    return undefined
  })
  if (rootRealpath === undefined) return honoApp

  const rootPrefix = rootRealpath + sep

  return honoApp.get('/*', async (c, next) => {
    const { path } = c.req

    if (PUBLIC_DIR_SECRET_BLOCKLIST.test(path)) {
      await next()
      return
    }

    const joinedPath = join(rootRealpath, path)
    const targetRealpath = await realpath(joinedPath).catch(() => undefined)
    if (
      targetRealpath === undefined ||
      (targetRealpath !== rootRealpath && !targetRealpath.startsWith(rootPrefix))
    ) {
      await next()
      return
    }

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


const ISLAND_OUT_DIR = isBundled
  ? resolvePackagePath('dist', 'island-chunks')
  : join(tmpdir(), 'sovrium-islands')

export interface IslandBuildResult {
  readonly entryFile: string
}

export const buildIslands = (() => {
  const build = async (): Promise<IslandBuildResult> => {
    if (isCompiled || isBundled) {
      logDebug('[ISLANDS] Using pre-built island entry')
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
      plugins: [codemirrorDedupePlugin],
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
  }

  return memoizeUnlessDev(build)
})()

function emptyChunkStub(): Response {
  return new Response('/* empty island chunk */', {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': getCacheControlHeader(),
    },
  })
}

const CONTENT_HASHED_ASSET = /-[a-z0-9]{8}\.js$/
const isContentHashed = (name: string): boolean => CONTENT_HASHED_ASSET.test(name)

function assetCacheControl(name: string): string {
  return isProduction && isContentHashed(name)
    ? 'public, max-age=31536000, immutable'
    : getCacheControlHeader()
}

export function setupIslandRoutes(honoApp: Readonly<Hono>): Readonly<Hono> {
  return honoApp.get('/assets/islands/*', async (c) => {
    try {
      const relativePath = c.req.path.replace('/assets/islands/', '')

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

export async function setupStaticAssets(
  honoApp: Readonly<Hono>,
  app: App,
  publicDir?: string
): Promise<Readonly<Hono>> {
  const withAssets = setupIslandRoutes(
    setupAnalyticsScriptRoute(
      setupClientBundleRoute(setupJavaScriptRoutes(setupCSSRoute(honoApp, app))),
      app
    )
  )
  return publicDir ? setupPublicDirRoute(withAssets, publicDir) : withAssets
}
