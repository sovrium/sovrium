/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Console, Schema } from 'effect'
import { AppValidationError } from '@/application/errors/app-validation-error'
import { StaticGenerationError } from '@/application/errors/static-generation-error'
import {
  CSSCompiler as CSSCompilerService,
  type CSSCompilationError,
} from '@/application/ports/css-compiler'
import { PageRenderer as PageRendererService } from '@/application/ports/page-renderer'
import { ServerFactory as ServerFactoryService } from '@/application/ports/server-factory'
import {
  StaticSiteGenerator as StaticSiteGeneratorService,
  type SSGGenerationError,
} from '@/application/ports/static-site-generator'
import { AppSchema } from '@/domain/models/app'
import {
  formatHtmlWithPrettier,
  generateClientHydrationScript,
  generateRobotsContent,
  generateSitemapContent,
} from './static-content-generators'
import {
  generateMultiLanguageFiles,
  generateSingleLanguageFiles,
} from './static-language-generators'
import {
  injectHydrationScript,
  isGitHubPagesUrl,
  rewriteBasePathInHtml,
} from './static-url-rewriter'
import type { App } from '@/domain/models/app'
import type { AuthConfigRequiredForUserFields } from '@/infrastructure/errors/auth-config-required-error'
import type { SchemaInitializationError } from '@/infrastructure/errors/schema-initialization-error'
import type { ServerCreationError } from '@/infrastructure/errors/server-creation-error'
import type { FileCopyError } from '@/infrastructure/filesystem/copy-directory'

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
  | SSGGenerationError
  | FileCopyError
  | AuthConfigRequiredForUserFields
  | SchemaInitializationError
  | Error,
  ServerFactoryService | PageRendererService | CSSCompilerService | StaticSiteGeneratorService
> =>
  // eslint-disable-next-line max-lines-per-function, max-statements, complexity -- Complex Effect generator with multiple file generation steps and support file creation
  Effect.gen(function* () {
    // Step 1: Import dependencies
    const fs = yield* Effect.tryPromise({
      try: () => import('node:fs/promises'),
      catch: (error) =>
        new StaticGenerationError({
          message: 'Failed to import fs module',
          cause: error,
        }),
    })

    const { replaceAppTokens } = yield* Effect.tryPromise({
      try: () => import('./translation-replacer'),
      catch: (error) =>
        new StaticGenerationError({
          message: 'Failed to import translation-replacer module',
          cause: error,
        }),
    })

    // Step 2: Pre-process app to handle multi-language (replace tokens BEFORE validation)
    // If languages are configured, we need to skip token validation and handle it specially
    const rawApp = app as Record<string, unknown>
    const hasLanguages = rawApp.languages !== undefined

    // For multi-language apps, validate without pages first, then process each language
    const validatedApp: App =
      hasLanguages && rawApp.pages
        ? yield* Effect.gen(function* () {
            // Validate app without pages (to check languages config)
            const appWithoutPages = { ...rawApp, pages: undefined }
            const baseApp = yield* Effect.try({
              try: (): App => Schema.decodeUnknownSync(AppSchema)(appWithoutPages),
              catch: (error) => new AppValidationError(error),
            })

            // Use base app with original pages for now (will process per language)
            return { ...baseApp, pages: rawApp.pages as App['pages'] }
          })
        : yield* Effect.gen(function* () {
            // No languages or no pages - validate normally
            yield* Console.log('🔍 Validating app schema...')
            return yield* Effect.try({
              try: (): App => Schema.decodeUnknownSync(AppSchema)(app),
              catch: (error) => new AppValidationError(error),
            })
          })

    // Step 3: Get services from context
    const serverFactory = yield* ServerFactoryService
    const pageRenderer = yield* PageRendererService
    const cssCompiler = yield* CSSCompilerService
    const staticSiteGenerator = yield* StaticSiteGeneratorService

    const outputDir = options.outputDir || './static'

    // Step 4: Generate static files for each language (or once if no languages)
    const allGeneratedFiles: readonly string[] =
      validatedApp.languages && validatedApp.pages
        ? yield* generateMultiLanguageFiles(
            validatedApp,
            outputDir,
            replaceAppTokens,
            serverFactory,
            pageRenderer,
            staticSiteGenerator
          )
        : yield* generateSingleLanguageFiles(
            validatedApp,
            outputDir,
            serverFactory,
            pageRenderer,
            staticSiteGenerator
          )

    // Step 5: Get CSS from cache (already compiled during server creation)
    yield* Console.log('🎨 Getting compiled CSS...')
    const { css } = yield* cssCompiler.compile(validatedApp)

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

    // Generate client.js for hydration if enabled
    const hydrationFiles = yield* Effect.if(options.hydration ?? false, {
      onTrue: () =>
        Effect.gen(function* () {
          yield* Console.log('💧 Generating client-side hydration script...')
          const clientJS = generateClientHydrationScript()
          yield* Effect.tryPromise({
            try: () => fs.writeFile(`${outputDir}/assets/client.js`, clientJS, 'utf-8'),
            catch: (error) =>
              new StaticGenerationError({
                message: 'Failed to write client.js',
                cause: error,
              }),
          })
          return ['assets/client.js'] as const
        }),
      onFalse: () => Effect.succeed([] as readonly string[]),
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

    // Collect all generated files (HTML from toSSG + CSS + hydration + assets)
    const generatedFiles = [
      ...allGeneratedFiles,
      'assets/output.css',
      ...hydrationFiles,
      ...assetFiles,
    ] as readonly string[]

    // Step 5a: Format HTML files with Prettier for better readability
    yield* Console.log('📝 Formatting HTML files with Prettier...')
    const path = yield* Effect.tryPromise({
      try: () => import('node:path'),
      catch: (error) =>
        new StaticGenerationError({
          message: 'Failed to import path module',
          cause: error,
        }),
    })

    // Format each HTML file with Prettier (exclude .js.html and other asset files)
    yield* Effect.forEach(
      generatedFiles.filter((f) => f.endsWith('.html') && !f.endsWith('.js.html')),
      (file) =>
        Effect.gen(function* () {
          const filePath = file.startsWith('/') ? file : path.join(outputDir, file)
          const content = yield* Effect.tryPromise({
            try: () => fs.readFile(filePath, 'utf-8'),
            catch: (error) =>
              new StaticGenerationError({
                message: `Failed to read HTML file for formatting: ${file}`,
                cause: error,
              }),
          })
          const formatted = yield* Effect.tryPromise({
            try: () => formatHtmlWithPrettier(content),
            catch: (error) =>
              new StaticGenerationError({
                message: `Failed to format HTML with Prettier: ${file}`,
                cause: error,
              }),
          })
          yield* Effect.tryPromise({
            try: () => fs.writeFile(filePath, formatted, 'utf-8'),
            catch: (error) =>
              new StaticGenerationError({
                message: `Failed to write formatted HTML file: ${file}`,
                cause: error,
              }),
          })
        }),
      { concurrency: 'unbounded' }
    )

    // Step 5b: Apply base path rewriting if basePath is configured
    yield* Effect.if(options.basePath !== undefined && options.basePath !== '', {
      onTrue: () =>
        rewriteBasePathInHtml(generatedFiles, outputDir, options.basePath!, options.baseUrl, fs),
      onFalse: () => Effect.succeed(undefined),
    })

    // Step 5c: Inject hydration script into HTML if enabled
    yield* Effect.if(options.hydration ?? false, {
      onTrue: () =>
        injectHydrationScript(generatedFiles, outputDir, options.basePath || '', fs, path),
      onFalse: () => Effect.succeed(undefined),
    })

    // Get pages for sitemap generation
    const pages = validatedApp.pages || []

    // Step 6: Generate supporting files
    const sitemapFiles = yield* Effect.if(options.generateSitemap ?? false, {
      onTrue: () =>
        Effect.gen(function* () {
          yield* Console.log('🗺️  Generating sitemap.xml...')
          // Check if multi-language is enabled
          const isMultiLanguage =
            validatedApp.languages !== undefined && options.languages !== undefined
          const languages = isMultiLanguage ? options.languages : undefined
          const basePath = options.basePath || ''

          const sitemap = generateSitemapContent(
            pages,
            options.baseUrl || 'https://example.com',
            basePath,
            languages
          )
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
          const basePath = options.basePath || ''
          const robots = generateRobotsContent(
            pages,
            options.baseUrl || 'https://example.com',
            basePath,
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

    // Generate CNAME file for custom domains on GitHub Pages
    const cnameFiles = yield* Effect.if(
      options.deployment === 'github-pages' &&
        options.baseUrl !== undefined &&
        !isGitHubPagesUrl(options.baseUrl),
      {
        onTrue: () =>
          Effect.gen(function* () {
            const domain = new URL(options.baseUrl!).hostname
            yield* Console.log(`📄 Creating CNAME file for custom domain: ${domain}...`)
            yield* Effect.tryPromise({
              try: () => fs.writeFile(`${outputDir}/CNAME`, domain, 'utf-8'),
              catch: (error) =>
                new StaticGenerationError({
                  message: 'Failed to write CNAME',
                  cause: error,
                }),
            })
            return ['CNAME'] as const
          }),
        onFalse: () => Effect.succeed([] as readonly string[]),
      }
    )

    // Combine all files immutably
    const allFiles = [
      ...generatedFiles,
      ...sitemapFiles,
      ...robotsFiles,
      ...githubFiles,
      ...cnameFiles,
    ] as readonly string[]

    yield* Console.log(`✅ Generated ${allFiles.length} files to ${outputDir}`)

    return {
      outputDir,
      files: allFiles,
    }
  })
