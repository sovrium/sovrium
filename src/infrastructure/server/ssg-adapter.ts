/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Data } from 'effect'
import { toSSG } from 'hono/bun'
import type { Hono } from 'hono'

export class SSGGenerationError extends Data.TaggedError('SSGGenerationError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

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
  readonly pagePaths?: readonly string[]
  readonly publicDir?: string
}

function registerPagePaths(
  app: Hono,
  pagePaths: readonly string[]
): void {
  const mutableApp = app as Hono

  for (const path of pagePaths) {
    if (path !== '/') {
      mutableApp.get(path, (c) => c.text(''))
    }
  }
}

function shouldExcludeRoute(pathname: string): boolean {
  return (
    pathname === '/api/health' ||
    pathname === '/api/openapi.json' ||
    pathname === '/api/scalar' ||
    pathname.startsWith('/api/auth/') ||
    pathname === '/api/tables' ||
    pathname.startsWith('/api/tables/') ||
    pathname === '/api/records' ||
    pathname.startsWith('/api/records/') ||
    pathname.startsWith('/test/')
  )
}

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

export const generateStaticSite = (
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

      if (options.pagePaths && options.pagePaths.length > 0) {
        registerPagePaths(app as Hono, options.pagePaths)
      }

      const result = await toSSG(app as Hono, {
        dir: outputDir,
        beforeRequestHook: (req) => {
          const url = new URL(req.url)
          return shouldExcludeRoute(url.pathname) ? false : req
        },
      })

      if (!result.success) {
        throw new Error(
          `Static site generation failed: ${result.error?.message || 'Unknown error'}`
        )
      }

      const normalizedFiles = (result.files as readonly string[]).map((file) =>
        normalizeFilePath(file, outputDir)
      )

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

interface SitemapPage {
  readonly path: string
  readonly priority?: string
  readonly changefreq?: string
}

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

export const robotsPlugin = (baseUrl: string, includeSitemap: boolean = false) => ({
  name: 'robots',
  async generate() {
    const baseLines = ['User-agent: *', 'Allow: /'] as const
    const sitemapLine = includeSitemap ? ([`Sitemap: ${baseUrl}/sitemap.xml`] as const) : []
    const lines = [...baseLines, ...sitemapLine] as readonly string[]

    return lines.join('\n')
  },
})
