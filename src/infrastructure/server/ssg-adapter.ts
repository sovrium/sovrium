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
  app: Hono,
  options: Readonly<SSGOptions>
): Effect.Effect<
  { readonly outputDir: string; readonly files: readonly string[] },
  SSGGenerationError,
  never
> =>
  Effect.tryPromise({
    try: async () => {
      const outputDir = options.outputDir || './static'

      // Use Hono's toSSG to generate static files
      // Note: toSSG result is currently not used as the API doesn't return file list
      // This will be properly implemented when we integrate with Hono's SSG
      // eslint-disable-next-line functional/no-expression-statements -- Required await for async operation
      await toSSG(app, {
        dir: outputDir,
        // Additional options will be configured here
      })

      // Collect generated file paths
      // Note: The actual file list would come from toSSG result
      // For now, we'll return a placeholder
      // This will be properly implemented when we integrate with Hono's SSG
      const files: readonly string[] = []

      return {
        outputDir,
        files,
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
