/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
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
 * Generate static site using Hono's SSG functionality
 *
 * This adapter wraps Hono's toSSG function with Effect.ts patterns
 * and Sovrium-specific logic.
 *
 * @param app - Hono application instance
 * @param options - Static generation options
 * @returns Effect with output directory and generated files
 */
// eslint-disable-next-line max-lines-per-function -- Complex SSG integration with route registration, toSSG invocation, and result validation. Splitting would harm readability.
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

      // If pagePaths are provided, we need to explicitly register them in the app
      // because Hono's toSSG can only discover routes that are explicitly defined
      // (it can't auto-discover all paths handled by wildcard routes)
      if (options.pagePaths && options.pagePaths.length > 0) {
        // Cast to mutable Hono to register explicit routes for SSG
        const mutableApp = app as Hono

        // Register explicit GET routes for each page path
        // These will be discovered by toSSG during route crawling
        // eslint-disable-next-line functional/no-loop-statements -- Imperative route registration required by Hono's mutable API for toSSG discovery
        for (const path of options.pagePaths) {
          // Only register if not already the root path (/ is already registered)
          if (path !== '/') {
            // Register the route explicitly so toSSG can discover it
            // The actual handler doesn't matter because toSSG will fetch it anyway
            // eslint-disable-next-line functional/no-expression-statements -- Necessary side effect to mutate Hono app for toSSG route discovery
            mutableApp.get(path, (c) => c.text(''))
          }
        }
      }

      // Use Hono's toSSG to generate static files
      // Cast app as mutable Hono since toSSG expects mutable type
      const result = await toSSG(app as Hono, {
        dir: outputDir,
        beforeRequestHook: (req) => {
          const url = new URL(req.url)
          // Exclude actual API routes (but not pages that happen to have /api/ in path)
          // API routes are: /api/health, /api/openapi.json, /api/scalar, /api/auth/*
          // We explicitly registered page paths, so they will be generated even if they start with /api/
          // Only exclude routes that match actual API route patterns
          if (
            url.pathname === '/api/health' ||
            url.pathname === '/api/openapi.json' ||
            url.pathname === '/api/scalar' ||
            url.pathname.startsWith('/api/auth/') ||
            url.pathname.startsWith('/api/tables/') ||
            url.pathname.startsWith('/api/records/') ||
            url.pathname.startsWith('/test/')
          ) {
            return false // Skip this route
          }
          return req // Include this route
        },
      })

      // Check if SSG generation was successful
      if (!result.success) {
        // eslint-disable-next-line functional/no-throw-statements -- Error handling requires throw
        throw new Error(
          `Static site generation failed: ${result.error?.message || 'Unknown error'}`
        )
      }

      // Return output directory and generated files from toSSG
      return {
        outputDir,
        files: result.files as readonly string[],
      } as const
    },
    catch: (error) =>
      new SSGGenerationError({
        message: `Static site generation failed: ${error instanceof Error ? error.message : String(error)}`,
        cause: error,
      }),
  })

/**
 * Page info for sitemap generation
 */
interface SitemapPage {
  readonly path: string
  readonly priority?: string
  readonly changefreq?: string
}

/**
 * Plugin to generate sitemap.xml
 */
export const sitemapPlugin = (baseUrl: string) => ({
  name: 'sitemap',
  async generate(pages: readonly SitemapPage[]) {
    const entries = pages.map(
      (page) => `  <url>
    <loc>${baseUrl}${page.path}</loc>
    <priority>${page.priority || '0.5'}</priority>
    <changefreq>${page.changefreq || 'monthly'}</changefreq>
  </url>`
    )

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>`
  },
})

/**
 * Plugin to generate robots.txt
 */
export const robotsPlugin = (baseUrl: string, includeSitemap: boolean = false) => ({
  name: 'robots',
  async generate() {
    const baseLines = ['User-agent: *', 'Allow: /'] as const
    const sitemapLine = includeSitemap ? ([`Sitemap: ${baseUrl}/sitemap.xml`] as const) : []
    const lines = [...baseLines, ...sitemapLine] as readonly string[]

    return lines.join('\n')
  },
})
