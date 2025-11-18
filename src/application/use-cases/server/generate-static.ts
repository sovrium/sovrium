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
import { compileCSS } from '@/infrastructure/css/compiler'
import { generateStaticSite } from '@/infrastructure/server/ssg-adapter'
import type { PageRenderer } from '@/application/ports/page-renderer'
import type { ServerFactory } from '@/application/ports/server-factory'
import type { App, Page } from '@/domain/models/app'
import type { CSSCompilationError } from '@/infrastructure/errors/css-compilation-error'
import type { ServerCreationError } from '@/infrastructure/errors/server-creation-error'
import type { SSGGenerationError } from '@/infrastructure/server/ssg-adapter'

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
  readonly publicDir?: string // Directory containing static assets to copy
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
  | AppValidationError
  | StaticGenerationError
  | CSSCompilationError
  | ServerCreationError
  | SSGGenerationError,
  ServerFactory | PageRenderer
> =>
  // eslint-disable-next-line max-lines-per-function, max-statements -- Complex Effect generator with multiple file generation steps and support file creation
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

    // Step 3: Create server instance (temporarily) to get Hono app
    // Note: Server will be stopped immediately after getting the app instance
    yield* Console.log('🏗️  Creating application instance...')
    const serverInstance = yield* serverFactory.create({
      app: validatedApp,
      port: 0, // Auto-select available port
      hostname: 'localhost',
      renderHomePage: pageRenderer.renderHome,
      renderPage: pageRenderer.renderPage,
      renderNotFoundPage: pageRenderer.renderNotFound,
      renderErrorPage: pageRenderer.renderError,
    })

    // Stop the server immediately - we only needed the Hono app
    yield* serverInstance.stop

    // Step 4: Generate static HTML files using Hono's toSSG
    // Extract page paths from app configuration to explicitly tell toSSG which paths to generate
    const pagePaths = validatedApp.pages?.map((page) => page.path) || []
    yield* Console.log(`📝 Generating static HTML files for ${pagePaths.length} pages...`)
    const outputDir = options.outputDir || './static'
    const ssgResult = yield* generateStaticSite(serverInstance.app, { outputDir, pagePaths })

    // Step 5: Get CSS from cache (already compiled during server creation)
    yield* Console.log('🎨 Getting compiled CSS...')
    const { css } = yield* compileCSS(validatedApp)

    // Import fs module for CSS file operations
    const fs = yield* Effect.tryPromise({
      try: () => import('node:fs/promises'),
      catch: (error) =>
        new StaticGenerationError({
          message: 'Failed to import fs module',
          cause: error,
        }),
    })

    // Create assets directory
    yield* Effect.tryPromise({
      try: () => fs.mkdir(`${outputDir}/assets`, { recursive: true }),
      catch: (error) =>
        new StaticGenerationError({
          message: `Failed to create assets directory`,
          cause: error,
        }),
    })

    // Write CSS file
    yield* Effect.tryPromise({
      try: () => fs.writeFile(`${outputDir}/assets/output.css`, css, 'utf-8'),
      catch: (error) =>
        new StaticGenerationError({
          message: 'Failed to write CSS file',
          cause: error,
        }),
    })

    // Step 6: Copy static assets from publicDir if provided
    const assetFiles = yield* Effect.if(options.publicDir !== undefined, {
      onTrue: () =>
        Effect.gen(function* () {
          yield* Console.log(`📁 Copying assets from ${options.publicDir}...`)
          const { copyDirectory } = yield* Effect.tryPromise({
            try: () => import('@/infrastructure/filesystem/copy-directory'),
            catch: (error) =>
              new StaticGenerationError({
                message: 'Failed to import copy-directory module',
                cause: error,
              }),
          })
          return yield* copyDirectory(options.publicDir!, outputDir)
        }),
      onFalse: () => Effect.succeed([] as readonly string[]),
    })

    // Collect all generated files (HTML from toSSG + CSS + assets)
    const generatedFiles = [
      ...ssgResult.files,
      'assets/output.css',
      ...assetFiles,
    ] as readonly string[]

    // Get pages for sitemap generation
    const pages = validatedApp.pages || []

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
