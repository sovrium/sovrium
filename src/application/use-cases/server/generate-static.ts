/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Console, Schema, type Context } from 'effect'
import { AppValidationError } from '@/application/errors/app-validation-error'
import {
  CSSCompiler as CSSCompilerService,
  type CSSCompilationError,
} from '@/application/ports/services/css-compiler'
import { PageRenderer as PageRendererService } from '@/application/ports/services/page-renderer'
import { ServerFactory as ServerFactoryService } from '@/application/ports/services/server-factory'
import {
  StaticSiteGenerator as StaticSiteGeneratorService,
  type SSGGenerationError,
} from '@/application/ports/services/static-site-generator'
import { AppSchema } from '@/domain/models/app'
import {
  fs,
  path,
  translationReplacer,
  writeCssFile,
  generateHydrationFiles,
  copyPublicAssets,
  formatHtmlFiles,
  applyHtmlOptimizations,
  generateSitemapFile,
  generateRobotsFile,
  generateGitHubPagesFiles,
  type FileSystemLike,
} from './generate-static-helpers'
import {
  generateMultiLanguageFiles,
  generateSingleLanguageFiles,
} from './static-language-generators'
import type { StaticGenerationError } from '@/application/errors/static-generation-error'
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
 * Validate app schema handling multi-language apps
 */
function validateAppSchema(app: unknown): Effect.Effect<App, AppValidationError, never> {
  const rawApp = app as Record<string, unknown>
  const hasLanguages = rawApp.languages !== undefined

  return hasLanguages && rawApp.pages
    ? Effect.gen(function* () {
        const appWithoutPages = { ...rawApp, pages: undefined }
        const baseApp = yield* Effect.try({
          try: (): App => Schema.decodeUnknownSync(AppSchema)(appWithoutPages),
          catch: (error) => new AppValidationError(error),
        })
        return { ...baseApp, pages: rawApp.pages as App['pages'] }
      })
    : Effect.gen(function* () {
        yield* Console.log('🔍 Validating app schema...')
        return yield* Effect.try({
          try: (): App => Schema.decodeUnknownSync(AppSchema)(app),
          catch: (error) => new AppValidationError(error),
        })
      })
}

/**
 * Get required services from Effect context
 */
function getServicesFromContext() {
  return Effect.gen(function* () {
    return {
      serverFactory: yield* ServerFactoryService,
      pageRenderer: yield* PageRendererService,
      cssCompiler: yield* CSSCompilerService,
      staticSiteGenerator: yield* StaticSiteGeneratorService,
    }
  })
}

/**
 * Generate HTML files for single or multi-language apps
 */
function generateHtmlFiles(
  app: App,
  outputDir: string,
  replaceAppTokens: (app: App, lang: string) => App,
  serverFactory: Context.Tag.Service<ServerFactoryService>,
  pageRenderer: Context.Tag.Service<PageRendererService>,
  staticSiteGenerator: Context.Tag.Service<StaticSiteGeneratorService>
) {
  return app.languages && app.pages
    ? generateMultiLanguageFiles(
        app,
        outputDir,
        replaceAppTokens,
        serverFactory,
        pageRenderer,
        staticSiteGenerator
      )
    : generateSingleLanguageFiles(app, outputDir, serverFactory, pageRenderer, staticSiteGenerator)
}

/**
 * Generate and write CSS file
 */
function generateCssFile(
  outputDir: string,
  app: App,
  cssCompiler: Context.Tag.Service<CSSCompilerService>,
  fs: FileSystemLike
) {
  return Effect.gen(function* () {
    yield* Console.log('🎨 Getting compiled CSS...')
    const { css } = yield* cssCompiler.compile(app)
    return yield* writeCssFile(outputDir, css, fs)
  })
}

/**
 * Optimize HTML files with formatting and transformations
 *
 * @param generatedFiles - List of generated file paths
 * @param outputDir - Output directory path
 * @param options - Static generation options
 * @param fsModule - Filesystem module (Node.js fs/promises or Bun's equivalent)
 */
function optimizeHtmlFiles(
  generatedFiles: readonly string[],
  outputDir: string,
  options: GenerateStaticOptions,
  fsModule: FileSystemLike
) {
  return Effect.gen(function* () {
    yield* formatHtmlFiles(generatedFiles, outputDir, fsModule, path)
    yield* applyHtmlOptimizations({
      generatedFiles,
      outputDir,
      options,
      fs: fsModule,
      path,
    })
  })
}

/**
 * Generate all supporting files (sitemap, robots.txt, GitHub Pages files)
 */
function generateSupportingFiles(
  app: App,
  outputDir: string,
  options: GenerateStaticOptions,
  fs: FileSystemLike
) {
  return Effect.gen(function* () {
    const sitemapFiles = yield* generateSitemapFile(app, outputDir, options, fs)
    const robotsFiles = yield* generateRobotsFile(app, outputDir, options, fs)
    const githubFiles = yield* generateGitHubPagesFiles(outputDir, options, fs)

    return [...sitemapFiles, ...robotsFiles, ...githubFiles] as readonly string[]
  })
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
  | AppValidationError
  | StaticGenerationError
  | SSGGenerationError
  | CSSCompilationError
  | ServerCreationError
  | FileCopyError
  | AuthConfigRequiredForUserFields
  | SchemaInitializationError
  | Error,
  ServerFactoryService | PageRendererService | CSSCompilerService | StaticSiteGeneratorService
> => {
  const program = Effect.gen(function* () {
    // Step 1: Dependencies are statically imported
    const { replaceAppTokens } = translationReplacer

    // Step 2: Validate app schema
    const validatedApp = yield* validateAppSchema(app)

    // Step 3: Get services and initialize
    const services = yield* getServicesFromContext()
    const outputDir = options.outputDir || './static'

    // Step 4: Generate HTML files
    const htmlFiles = yield* generateHtmlFiles(
      validatedApp,
      outputDir,
      replaceAppTokens,
      services.serverFactory,
      services.pageRenderer,
      services.staticSiteGenerator
    )

    // Step 5: Generate CSS and assets
    const cssFile = yield* generateCssFile(outputDir, validatedApp, services.cssCompiler, fs)
    const hydrationFiles = yield* generateHydrationFiles(outputDir, options.hydration ?? false, fs)
    const assetFiles = yield* copyPublicAssets(options.publicDir, outputDir)

    // Collect all generated files
    const generatedFiles = [
      ...htmlFiles,
      cssFile,
      ...hydrationFiles,
      ...assetFiles,
    ] as readonly string[]

    // Step 6: Optimize HTML files
    yield* optimizeHtmlFiles(generatedFiles, outputDir, options, fs)

    // Step 7: Generate supporting files
    const supportingFiles = yield* generateSupportingFiles(validatedApp, outputDir, options, fs)

    // Combine all files immutably
    const allFiles = [...generatedFiles, ...supportingFiles] as readonly string[]

    yield* Console.log(`✅ Generated ${allFiles.length} files to ${outputDir}`)

    return {
      outputDir,
      files: allFiles,
    }
  })

  return program as Effect.Effect<
    GenerateStaticResult,
    | AppValidationError
    | StaticGenerationError
    | SSGGenerationError
    | CSSCompilationError
    | ServerCreationError
    | FileCopyError
    | AuthConfigRequiredForUserFields
    | SchemaInitializationError
    | Error,
    ServerFactoryService | PageRendererService | CSSCompilerService | StaticSiteGeneratorService
  >
}
