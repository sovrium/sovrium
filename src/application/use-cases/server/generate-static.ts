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
import type { App, Page } from '@/domain/models/app'
import type { CSSCompilationError } from '@/infrastructure/errors/css-compilation-error'
import type { ServerCreationError } from '@/infrastructure/errors/server-creation-error'

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
// eslint-disable-next-line max-lines-per-function -- Complex generator function for static generation workflow
export const generateStatic = (
  app: unknown,
  options: GenerateStaticOptions = {}
): Effect.Effect<
  GenerateStaticResult,
  AppValidationError | StaticGenerationError | CSSCompilationError | ServerCreationError,
  ServerFactory | PageRenderer
> =>
  // eslint-disable-next-line max-lines-per-function -- Complex Effect generator with multiple file generation steps
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
    // Note: We create the Hono app for future SSG integration
    // Currently unused but will be used when full SSG is implemented
    yield* serverFactory.create({
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
    const pages = validatedApp.pages || []

    // Generate HTML files for all pages using functional approach
    const generatedFiles = yield* Effect.forEach(pages, (page: Page) =>
      Effect.gen(function* () {
        // Generate HTML content
        const html = generatePageHtml(page, validatedApp)

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

        return fileName
      })
    )

    // Step 5: Generate supporting files
    const sitemapFiles = yield* Effect.if(options.generateSitemap ?? false, {
      onTrue: () =>
        Effect.gen(function* () {
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
          return ['sitemap.xml'] as const
        }),
      onFalse: () => Effect.succeed([] as readonly string[]),
    })

    const robotsFiles = yield* Effect.if(options.generateRobotsTxt ?? false, {
      onTrue: () =>
        Effect.gen(function* () {
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
          return ['robots.txt'] as const
        }),
      onFalse: () => Effect.succeed([] as readonly string[]),
    })

    const githubFiles = yield* Effect.if(options.deployment === 'github-pages', {
      onTrue: () =>
        Effect.gen(function* () {
          yield* Console.log('📄 Creating .nojekyll file for GitHub Pages...')
          yield* Effect.tryPromise({
            try: () => fs.writeFile(`${outputDir}/.nojekyll`, '', 'utf-8'),
            catch: (error) =>
              new StaticGenerationError({
                message: 'Failed to write .nojekyll',
                cause: error,
              }),
          })
          return ['.nojekyll'] as const
        }),
      onFalse: () => Effect.succeed([] as readonly string[]),
    })

    // Combine all files immutably
    const allFiles = [
      ...generatedFiles,
      ...sitemapFiles,
      ...robotsFiles,
      ...githubFiles,
    ] as readonly string[]

    yield* Console.log(`✅ Generated ${allFiles.length} files to ${outputDir}`)

    return {
      outputDir,
      files: allFiles,
    }
  })

/**
 * Generate HTML content for a single page
 */
const generatePageHtml = (page: Page, app: App): string => {
  // For now, generate simple HTML
  // TODO: Use PageRenderer when it has a renderPage method
  return `<!DOCTYPE html>
<html lang="${page.meta?.lang || 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${page.meta?.title || 'Page'}</title>
  ${page.meta?.description ? `<meta name="description" content="${page.meta.description}">` : ''}
</head>
<body>
  <h1>${app.name || 'Sovrium App'}</h1>
  ${app.description ? `<p>${app.description}</p>` : ''}
</body>
</html>`
}

/**
 * Generate sitemap.xml content
 */
const generateSitemapContent = (pages: readonly Page[], baseUrl: string): string => {
  const entries = pages.map(
    (page) => `  <url>
    <loc>${baseUrl}${page.path}</loc>
    <priority>0.5</priority>
    <changefreq>monthly</changefreq>
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
  const baseLines = ['User-agent: *', 'Allow: /']
  const sitemapLine = includeSitemap ? [`Sitemap: ${baseUrl}/sitemap.xml`] : []
  const lines = [...baseLines, ...sitemapLine]

  return lines.join('\n')
}
