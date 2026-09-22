/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Data } from 'effect'
import { toSSG } from 'hono/bun'
import type { Hono } from 'hono'

/**
 * SSG Generation Error - infrastructure layer error
 */
export class SSGGenerationError extends Data.TaggedError('SSGGenerationError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

/**
 * Options for static site generation (infrastructure layer)
 */
export interface SSGOptions {
  readonly outputDir?: string
  readonly baseUrl?: string
  readonly basePath?: string
  readonly deployment?: 'github-pages' | 'generic'
  readonly languages?: readonly string[]
  readonly defaultLanguage?: string
  readonly generateSitemap?: boolean
  readonly generateRobotsTxt?: boolean
  readonly hydration?: boolean
  readonly generateManifest?: boolean
  readonly bundleOptimization?: 'split' | 'none'
  readonly pagePaths?: readonly string[] // Explicit list of page paths to generate
  readonly publicDir?: string // Directory containing static assets to copy
}

/**
 * Register explicit page paths in Hono app for SSG discovery
 */
function registerPagePaths(
  // eslint-disable-next-line functional/prefer-immutable-types -- Hono type is mutable
  app: Hono,
  pagePaths: readonly string[]
): void {
  const mutableApp = app as Hono

  // eslint-disable-next-line functional/no-loop-statements -- Imperative route registration required by Hono's mutable API for toSSG discovery
  for (const path of pagePaths) {
    if (path !== '/') {
      // eslint-disable-next-line functional/no-expression-statements -- Necessary side effect to mutate Hono app for toSSG route discovery
      mutableApp.get(path, (c) => c.text(''))
    }
  }
}

/**
 * Check if a route should be excluded from SSG
 *
 * A static build emits the pages the configuration declares, and the assets
 * those pages reference. It never emits — and never requests — a route the
 * engine mounts for its own HTTP API: an API response is a live readback of a
 * server that is not running, and freezing one into a deployable site ships a
 * value that was true once.
 *
 * The rule is about WHO serves a route, not about how its path is spelled, so
 * the app's own declarations win over the prefix. A configuration is free to
 * declare a page at `/api/v1/users/profile`, and that page is still emitted —
 * which is why `declaredPages` is consulted before the prefix and a bare
 * `startsWith('/api/')` would be wrong.
 *
 * `/__sovrium_dev/` and `/test/` stay as separate literals because their
 * reason is different: they are not API routes, and the dev live-reload SSE
 * stream only ends at SSE_STREAM_MAX_LIFETIME_MS (25s) — toSSG awaits every
 * response body, so crawling it stalls each build for the full lifetime.
 */
function shouldExcludeRoute(pathname: string, declaredPages: ReadonlySet<string>): boolean {
  if (declaredPages.has(pathname)) {
    return false
  }

  return (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/__sovrium_dev/') ||
    pathname.startsWith('/test/')
  )
}

/**
 * Normalize file path to be relative to output directory
 */
function normalizeFilePath(file: string, outputDir: string): string {
  const normalizedOutputDir = outputDir.startsWith('./') ? outputDir.substring(2) : outputDir
  const normalizedFile = file.startsWith('./') ? file.substring(2) : file

  if (normalizedFile.startsWith(normalizedOutputDir + '/')) {
    return normalizedFile.substring(normalizedOutputDir.length + 1)
  }
  if (normalizedFile.startsWith(normalizedOutputDir)) {
    return normalizedFile.substring(normalizedOutputDir.length)
  }
  return normalizedFile
}

/**
 * Generate static site using Hono's SSG functionality
 *
 * This adapter wraps Hono's toSSG function with Effect.ts patterns
 * and Sovrium-specific logic.
 *
 * @param app - Hono application instance
 * @param options - Static generation options
 * @returns Effect with output directory and generated files
 */
export const generateStaticSite = (
  // eslint-disable-next-line functional/prefer-immutable-types -- Hono is a mutable class from external library
  app: Hono | Readonly<Hono>,
  options: Readonly<SSGOptions>
): Effect.Effect<
  { readonly outputDir: string; readonly files: readonly string[] },
  SSGGenerationError,
  never
> =>
  Effect.tryPromise({
    try: async () => {
      const outputDir = options.outputDir || './static'

      // Register explicit page paths for SSG discovery
      if (options.pagePaths && options.pagePaths.length > 0) {
        registerPagePaths(app as Hono, options.pagePaths)
      }

      // The pages the configuration declares, already filtered for access by
      // `getPublicPagePaths`. They win over the API prefix in the exclusion
      // check below, so a page declared under `/api/` is still emitted.
      const declaredPages = new Set(options.pagePaths ?? [])

      // Use Hono's toSSG to generate static files
      const result = await toSSG(app as Hono, {
        dir: outputDir,
        beforeRequestHook: (req) => {
          const url = new URL(req.url)
          return shouldExcludeRoute(url.pathname, declaredPages) ? false : req
        },
      })

      // Check if SSG generation was successful
      if (!result.success) {
        // eslint-disable-next-line functional/no-throw-statements -- Error handling requires throw
        throw new Error(
          `Static site generation failed: ${result.error?.message || 'Unknown error'}`
        )
      }

      // Normalize file paths to be relative to outputDir
      const normalizedFiles = (result.files as readonly string[]).map((file) =>
        normalizeFilePath(file, outputDir)
      )

      // Return output directory and generated files from toSSG
      return {
        outputDir,
        files: normalizedFiles,
      } as const
    },
    catch: (error) =>
      new SSGGenerationError({
        message: `Static site generation failed: ${error instanceof Error ? error.message : String(error)}`,
        cause: error,
      }),
  })
