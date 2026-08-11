/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
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
import { writePrecompiledCSS } from '@/infrastructure/css/cache/css-cache-service'
import { logDebug } from '@/infrastructure/logging'
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
  generateLlmsFiles,
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
  /**
   * Also write the compiled CSS to the pre-compiled artifact path
   * (`SOVRIUM_CSS_FILE`, else `.sovrium/output.css`) so a later
   * `sovrium start` can serve it without recompiling. Defaults to `true`,
   * which is what `sovrium build` wants.
   *
   * Set to `false` for callers that run this pipeline purely to materialize
   * throwaway HTML — notably the boot-time search-index pre-render, which
   * generates into a temp directory it deletes immediately. Such a caller
   * emitting the artifact would overwrite a stylesheet it does not own.
   */
  readonly emitPrecompiledCss?: boolean
}

/**
 * Result of static site generation
 */
export interface GenerateStaticResult {
  readonly outputDir: string
  readonly files: readonly string[]
}

/**
 * Decode the app for static generation — a RE-decode, not the gate.
 *
 * `build()` (`src/index.ts`) already ran this config through
 * `decodeAppConfigObject` — the shared pipeline, `onExcessProperty: 'error'`
 * and all — and hands `generateStatic` the NORMALIZED result. So by the time
 * this runs the verdict is settled; what remains is turning an
 * already-accepted object back into the `App` TYPE this module's callers need.
 *
 * THE MULTI-LANGUAGE BRANCH LOOKS LIKE A HOLE AND IS NOT ONE. When the app
 * declares `languages`, the pages are decoded WITHOUT and then re-attached raw,
 * because a page in a multi-language app may still carry `{{t.*}}` tokens that
 * do not typecheck until `replaceAppTokens` substitutes them. The pages are
 * decoded per language, AFTER substitution, in `static-language-generators.ts`
 * — so every page is validated, once per language it is emitted in, rather than
 * once here against a shape it does not yet have.
 *
 * Do not "fix" this by decoding the pages here as well: that would reject the
 * token spellings the feature exists to support, and it would decode every page
 * twice for no additional verdict.
 */
function validateAppSchema(app: unknown): Effect.Effect<App, AppValidationError, never> {
  const rawApp = app as Record<string, unknown>
  const hasLanguages = rawApp.languages !== undefined

  return hasLanguages && rawApp.pages
    ? Effect.gen(function* () {
        const appWithoutPages = { ...rawApp, pages: undefined }
        const baseApp = yield* Schema.decodeUnknown(AppSchema)(appWithoutPages).pipe(
          Effect.mapError((error) => new AppValidationError(error))
        )
        return { ...baseApp, pages: rawApp.pages as App['pages'] }
      })
    : Effect.gen(function* () {
        logDebug('Validating app schema...')
        return yield* Schema.decodeUnknown(AppSchema)(app).pipe(
          Effect.mapError((error) => new AppValidationError(error))
        )
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
  fs: FileSystemLike,
  emitPrecompiledCss: boolean
) {
  return Effect.gen(function* () {
    logDebug('Getting compiled CSS...')
    const { css } = yield* cssCompiler.compile(app)

    // Write to static output directory (dist/assets/output.css)
    const cssFile = yield* writeCssFile(outputDir, css, fs)

    if (!emitPrecompiledCss) {
      return cssFile
    }

    // Also write pre-compiled CSS for production start
    const precompiledPath = yield* writePrecompiledCSS(css).pipe(
      Effect.catchAll((error) =>
        Console.log(`⚠️ Could not write pre-compiled CSS: ${error}`).pipe(Effect.as(undefined))
      )
    )
    if (precompiledPath) {
      // User-visible (not debug): `sovrium build` documents this line as part of
      // its output contract so operators can confirm the production CSS artifact
      // was written..
      yield* Console.log(`Pre-compiled CSS written to ${precompiledPath}`)
    }

    return cssFile
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
    const llmsFiles = yield* generateLlmsFiles(app, outputDir, options, fs)
    const githubFiles = yield* generateGitHubPagesFiles(outputDir, options, fs)

    return [...sitemapFiles, ...robotsFiles, ...llmsFiles, ...githubFiles] as readonly string[]
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
    const cssFile = yield* generateCssFile(
      outputDir,
      validatedApp,
      services.cssCompiler,
      fs,
      options.emitPrecompiledCss ?? true
    )
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

    logDebug(`Generated ${allFiles.length} files to ${outputDir}`)

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
