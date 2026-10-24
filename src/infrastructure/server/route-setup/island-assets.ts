/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type Hono } from 'hono'
import {
  memoizeUnlessNoCache,
  PREBUILT_ISLAND_DIR,
  prebuiltIslandBuild,
  prebuiltIslandReader,
  servePrebuiltIslandEntry,
  servesPrebuiltEntries,
} from '@/infrastructure/assets/client-entries'
import { codemirrorDedupePlugin } from '@/infrastructure/assets/codemirror-dedupe-plugin'
import { getRuntimeAssets } from '@/infrastructure/assets/embedded-runtime-assets'
import { diskChunkReader } from '@/infrastructure/assets/island-chunk-readers'
import {
  computeIslandPreloadManifest,
  type IslandChunkReader,
  type IslandPreloadManifest,
} from '@/infrastructure/assets/island-preload-manifest'
import { islandPageReachOf, islandReachOf } from '@/infrastructure/assets/island-reach'
import { logError, logDebug } from '@/infrastructure/logging/logger'
import { isBundled, isCompiled, resolvePackagePath } from '@/infrastructure/process/package-paths'
import {
  ENTRY_CACHE_CONTROL,
  assetCacheControl,
  getCacheControlHeader,
  isProduction,
} from './asset-cache-control'
import { islandDirName, sweepStaleIslandDirs } from './island-dir-sweep'

/**
 * The React island bundle: where its chunks are built, how they are built, and
 * the route that serves them from disk or from the compiled binary.
 */

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
 * Under `isDevCacheDisabled()` the exposure is at its worst: `memoizeUnlessNoCache`
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
const ISLAND_OUT_DIR = isBundled ? PREBUILT_ISLAND_DIR : join(tmpdir(), islandDirName(process.pid))

/** The on-disk path of one `Bun.build` artifact. */
const artifactPath = (artifact: { readonly path: string }): string => artifact.path

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
   * subtracting the entry's own closure) and degrades to a page that declares no
   * `modulepreload` at all. See `@/infrastructure/assets/island-preload-manifest`.
   */
  readonly preloads: IslandPreloadManifest
  /**
   * Every `.js` file THIS build emitted, relative to the island directory —
   * set by a build from source only; a prebuilt bundle is listed by its reader.
   */
  readonly outputs?: readonly string[]
}

/**
 * Provides the island client bundle.
 *
 * From source: builds at runtime via Bun.build with code splitting.
 * In bundled mode: returns the pre-built entry from dist/island-chunks/island-entry.js.
 *
 * Result is memoized for the process lifetime (bypassed only under
 * `SOVRIUM_DEV_NO_CACHE=1`; see `memoizeUnlessNoCache`).
 */
export const buildIslands = (() => {
  let sweepStarted = false

  const build = async (): Promise<IslandBuildResult> => {
    // Compiled binary (embedded) and bundled mode (dist/) both ship a
    // pre-built island entry under the stable name `island-entry.js`, and
    // pages reference it by its content-hashed name (`island-entry-<hash>.js`,
    // served by `setupIslandRoutes`) so a deploy changes the URL they ask for.
    // Neither builds into tmpdir, so neither has anything to sweep — the
    // early return keeps the sweep out of those paths entirely.
    if (servesPrebuiltEntries) return prebuiltIslandBuild()

    // Reclaim the build directories of servers that have since exited. Started
    // at most once per process — under `isDevCacheDisabled()` this function runs
    // on EVERY request — and deliberately not awaited: it is housekeeping, so it
    // must never delay the first response, and `sweepStaleIslandDirs` never
    // throws, so it can never keep a server from starting.
    if (!sweepStarted) {
      sweepStarted = true
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
      throw new Error(`Island bundle build failed:\n${errors}`)
    }

    const entry = result.outputs.find((o) => o.kind === 'entry-point')
    if (!entry) {
      throw new Error('Island bundle build produced no entry-point output')
    }

    // Extract relative filename from absolute path
    const entryFile = entry.path.replace(ISLAND_OUT_DIR + '/', '')
    logDebug(`[ISLANDS] Built entry: ${entryFile} (${result.outputs.length} outputs)`)

    // Scope the manifest to THIS build's outputs. The directory is shared by
    // every build this process makes, so listing it would resolve each island
    // to two chunks from the second rebuild onward — see `toEmittedChunkPaths`.
    const reader = diskChunkReader(ISLAND_OUT_DIR, result.outputs.map(artifactPath))

    return {
      entryFile,
      preloads: await computeIslandPreloadManifest(reader, entryFile),
      outputs: await reader.list(),
    }
  }

  return memoizeUnlessNoCache(build)
})()

/**
 * Every file of the island bundle a page can ask for, relative to
 * `/assets/islands/`: the entry under the name pages reference, the chunks it
 * preloads and the ones it imports later.
 */
const listIslandFiles = async (): Promise<readonly string[]> => {
  const build = await buildIslands()
  const listed = build.outputs ?? (await (await prebuiltIslandReader()).list())
  return [...new Set([build.entryFile, ...listed])]
}

/** A reader over the island files the app serves: the bytes a browser would fetch. */
const servedIslandReader = (honoApp: Readonly<Hono>): IslandChunkReader => ({
  list: listIslandFiles,
  read: async (relativePath) => {
    const response = await honoApp.request(`/assets/islands/${relativePath}`)
    if (!response.ok) throw new Error(`No island file "${relativePath}" (${response.status})`)
    return response.text()
  },
})

/**
 * The island files a static build writes for its generated pages, relative to
 * `/assets/islands/`: what those pages reach (`island-reach.ts`) — the files
 * they name and what those import, and the chunk of each island they mount
 * with everything it imports — and the whole bundle when a mounted island
 * cannot be traced to its chunk, so a page never loses a file. A build from
 * source builds the bundle here, which is why this is done for a static build
 * and not at every boot.
 */
export async function islandFilesReachedBy(
  honoApp: Readonly<Hono>,
  pages: readonly string[]
): Promise<readonly string[]> {
  const reach = await islandReachOf(servedIslandReader(honoApp), pages.map(islandPageReachOf))
  if (reach !== undefined) return [...reach]
  logDebug('[ISLANDS] A mounted island could not be traced to its chunk: writing the whole bundle')
  return listIslandFiles()
}

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

export function setupIslandRoutes(honoApp: Readonly<Hono>): Readonly<Hono> {
  return honoApp.get('/assets/islands/*', async (c) => {
    try {
      const relativePath = c.req.path.replace('/assets/islands/', '')

      const entry = await servePrebuiltIslandEntry(c.req.raw, relativePath, ENTRY_CACHE_CONTROL)
      if (entry !== undefined) return entry

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
