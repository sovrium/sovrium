/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Console, Schema } from 'effect'
import { AppValidationError } from '@/application/errors/app-validation-error'
import { StaticGenerationError } from '@/application/errors/static-generation-error'
import { PageRenderer as PageRendererService } from '@/application/ports/page-renderer'
import { ServerFactory as ServerFactoryService } from '@/application/ports/server-factory'
import { AppSchema } from '@/domain/models/app'
import type { PageRenderer } from '@/application/ports/page-renderer'
import type { ServerFactory } from '@/application/ports/server-factory'
import type { App } from '@/domain/models/app'

/**
 * Options for static site generation
 */
export interface GenerateStaticOptions {
  readonly outputDir?: string // default: './static'
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
 * Result of static site generation
 */
export interface GenerateStaticResult {
  readonly outputDir: string
  readonly files: readonly string[]
}

/**
 * Generate static site from app configuration
 *
 * This use case:
 * 1. Validates the app schema
 * 2. Creates a Hono app instance
 * 3. Generates static HTML files
 * 4. Creates supporting files (sitemap, robots.txt, etc.)
 *
 * @param app - The app configuration (unknown type, will be validated)
 * @param options - Static generation options
 * @returns Effect with output directory and generated files
 */
export const generateStatic = (
  app: unknown,
  options: GenerateStaticOptions = {}
): Effect.Effect<
  GenerateStaticResult,
  AppValidationError | StaticGenerationError,
  ServerFactory | PageRenderer
> =>
  Effect.gen(function* () {
    // Step 1: Validate app schema
    yield* Console.log('🔍 Validating app schema...')
    const validatedApp = yield* Effect.try({
      try: (): App => Schema.decodeUnknownSync(AppSchema)(app),
      catch: (error) => new AppValidationError(error),
    })

    // Step 2: Get services from context
    const serverFactory = yield* ServerFactoryService
    const pageRenderer = yield* PageRendererService

    // Step 3: Create Hono app instance (without starting server)
    yield* Console.log('🏗️  Creating application instance...')
    const honoApp = yield* serverFactory.create({
      app: validatedApp,
      port: 0, // Not starting a server, just creating the app
      hostname: 'localhost',
      renderHomePage: pageRenderer.renderHome,
      renderPage: pageRenderer.renderPage,
      renderNotFoundPage: pageRenderer.renderNotFound,
      renderErrorPage: pageRenderer.renderError,
    })

    // Step 4: Generate static files
    yield* Console.log('📝 Generating static HTML files...')

    // For now, we'll create a simple implementation
    // The full SSG implementation will be added in the infrastructure layer
    const outputDir = options.outputDir || './static'

    // Import fs module for file operations
    const fs = yield* Effect.tryPromise({
      try: () => import('node:fs/promises'),
      catch: (error) =>
        new StaticGenerationError({
          message: 'Failed to import fs module',
          cause: error,
        }),
    })

    // Create output directory
    yield* Effect.tryPromise({
      try: () => fs.mkdir(outputDir, { recursive: true }),
      catch: (error) =>
        new StaticGenerationError({
          message: `Failed to create output directory: ${outputDir}`,
          cause: error,
        }),
    })

    // Generate files based on pages
    const files: string[] = []
    const pages = (validatedApp as any).pages || []

    for (const page of pages) {
      // For now, generate simple HTML
      // TODO: Use PageRenderer when it has a renderPage method
      const html = `<!DOCTYPE html>
<html lang="${page.meta?.lang || 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${page.meta?.title || 'Page'}</title>
  ${page.meta?.description ? `<meta name="description" content="${page.meta.description}">` : ''}
</head>
<body>
  <h1>${validatedApp.name || 'Sovrium App'}</h1>
  ${validatedApp.description ? `<p>${validatedApp.description}</p>` : ''}
</body>
</html>`

      // Determine file path
      const fileName = page.path === '/' ? 'index.html' : `${page.path.slice(1)}.html`
      const filePath = `${outputDir}/${fileName}`

      // Write file
      yield* Effect.tryPromise({
        try: () => fs.writeFile(filePath, html, 'utf-8'),
        catch: (error) =>
          new StaticGenerationError({
            message: `Failed to write file: ${filePath}`,
            cause: error,
          }),
      })

      files.push(fileName)
    }

    // Step 5: Generate supporting files
    if (options.generateSitemap) {
      yield* Console.log('🗺️  Generating sitemap.xml...')
      const sitemap = generateSitemapContent(pages, options.baseUrl || 'https://example.com')
      yield* Effect.tryPromise({
        try: () => fs.writeFile(`${outputDir}/sitemap.xml`, sitemap, 'utf-8'),
        catch: (error) =>
          new StaticGenerationError({
            message: 'Failed to write sitemap.xml',
            cause: error,
          }),
      })
      files.push('sitemap.xml')
    }

    if (options.generateRobotsTxt) {
      yield* Console.log('🤖 Generating robots.txt...')
      const robots = generateRobotsContent(
        options.baseUrl || 'https://example.com',
        options.generateSitemap
      )
      yield* Effect.tryPromise({
        try: () => fs.writeFile(`${outputDir}/robots.txt`, robots, 'utf-8'),
        catch: (error) =>
          new StaticGenerationError({
            message: 'Failed to write robots.txt',
            cause: error,
          }),
      })
      files.push('robots.txt')
    }

    if (options.deployment === 'github-pages') {
      yield* Console.log('📄 Creating .nojekyll file for GitHub Pages...')
      yield* Effect.tryPromise({
        try: () => fs.writeFile(`${outputDir}/.nojekyll`, '', 'utf-8'),
        catch: (error) =>
          new StaticGenerationError({
            message: 'Failed to write .nojekyll',
            cause: error,
          }),
      })
      files.push('.nojekyll')
    }

    yield* Console.log(`✅ Generated ${files.length} files to ${outputDir}`)

    return {
      outputDir,
      files,
    }
  })

/**
 * Generate sitemap.xml content
 */
const generateSitemapContent = (pages: readonly any[], baseUrl: string): string => {
  const entries = pages.map(
    (page) => `  <url>
    <loc>${baseUrl}${page.path}</loc>
    <priority>${page.meta?.priority || '0.5'}</priority>
    <changefreq>${page.meta?.changefreq || 'monthly'}</changefreq>
  </url>`
  )

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>`
}

/**
 * Generate robots.txt content
 */
const generateRobotsContent = (baseUrl: string, includeSitemap: boolean = false): string => {
  const lines = ['User-agent: *', 'Allow: /']

  if (includeSitemap) {
    lines.push(`Sitemap: ${baseUrl}/sitemap.xml`)
  }

  return lines.join('\n')
}
