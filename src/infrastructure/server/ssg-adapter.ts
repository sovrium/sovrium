/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { toSSG } from 'hono/bun'
import { StaticGenerationError } from '@/application/errors/static-generation-error'
import type { GenerateStaticOptions } from '@/application/use-cases/server/generate-static'
import type { Hono } from 'hono'

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
  app: Hono,
  options: GenerateStaticOptions
): Effect.Effect<{ outputDir: string; files: readonly string[] }, StaticGenerationError, never> =>
  Effect.tryPromise({
    try: async () => {
      const outputDir = options.outputDir || './static'

      // Use Hono's toSSG to generate static files
      const result = await toSSG(app, {
        dir: outputDir,
        // Additional options will be configured here
      })

      // Collect generated file paths
      const files: string[] = []

      // Note: The actual file list would come from toSSG result
      // For now, we'll return a placeholder
      // This will be properly implemented when we integrate with Hono's SSG

      return {
        outputDir,
        files,
      }
    },
    catch: (error) =>
      new StaticGenerationError({
        message: `Static site generation failed: ${error instanceof Error ? error.message : String(error)}`,
        cause: error,
      }),
  })

/**
 * Plugin to generate sitemap.xml
 */
export const sitemapPlugin = (baseUrl: string) => ({
  name: 'sitemap',
  async generate(pages: any[]) {
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
    const lines = ['User-agent: *', 'Allow: /']

    if (includeSitemap) {
      lines.push(`Sitemap: ${baseUrl}/sitemap.xml`)
    }

    return lines.join('\n')
  },
})
