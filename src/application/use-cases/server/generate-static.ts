/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
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
} from '@/application/ports/services/css-compiler'
import { PageRenderer as PageRendererService } from '@/application/ports/services/page-renderer'
import { ServerFactory as ServerFactoryService } from '@/application/ports/services/server-factory'
import {
  StaticSiteGenerator as StaticSiteGeneratorService,
  type SSGGenerationError,
} from '@/application/ports/services/static-site-generator'
import { AppSchema } from '@/domain/models/app'
import { writePrecompiledCSS } from '@/infrastructure/css/cache/css-cache-service'
import { getVersionedCssFileName } from '@/infrastructure/css/versioned-css-path'
import { logDebug } from '@/infrastructure/logging'
import { generateLlmsFiles } from './generate-llms-files'
import { generateMarkdownTwinFiles } from './generate-markdown-twins'
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
import { enumerateCollectionRecords, type CollectionRecordIndex } from './sitemap-record-fan-out'
import {
  generateMultiLanguageFiles,
  generateSingleLanguageFiles,
} from './static-language-generators'
import type { App } from '@/domain/models/app'
import type { AuthConfigRequiredForUserFields } from '@/infrastructure/errors/auth-config-required-error'
import type { SchemaInitializationError } from '@/infrastructure/errors/schema-initialization-error'
import type { ServerCreationError } from '@/infrastructure/errors/server-creation-error'
import type { TransformPresetError } from '@/infrastructure/errors/transform-preset-error'
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
        const baseApp = yield* Schema.decodeUnknownEffect(AppSchema)(appWithoutPages).pipe(
          Effect.mapError((error) => new AppValidationError(error))
        )
        return { ...baseApp, pages: rawApp.pages as App['pages'] }
      })
    : Effect.gen(function* () {
        logDebug('Validating app schema...')
        return yield* Schema.decodeUnknownEffect(AppSchema)(app).pipe(
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
 * Read the records the sitemap will list, once, when the build writes a
 * sitemap. The same result feeds the record pages the build renders and the
 * sitemap it writes (see `enumerateCollectionRecords`). Without a sitemap the
 * build lists nothing, so it reads nothing and renders no record page.
 */
function enumerateListedRecords(
  app: App,
  options: GenerateStaticOptions,
  pageRenderer: PageRendererService['Service']
): Effect.Effect<CollectionRecordIndex, StaticGenerationError, never> {
  if (!(options.generateSitemap ?? false)) return Effect.succeed(new Map())
  return Effect.tryPromise({
    try: () =>
      enumerateCollectionRecords(app.pages ?? [], {
        app,
        fetchRecords: pageRenderer.fetchSitemapRecords,
      }),
    catch: (error) =>
      new StaticGenerationError({
        message: 'Failed to read the collection records the sitemap lists',
        cause: error,
      }),
  }).pipe(Effect.withSpan('server.enumerate-listed-records'))
}

/**
 * The concrete record addresses to render as pages. An address still carrying
 * a route parameter (a `:lang` segment the language fan-out fills) names no
 * single file, so it is left to the declared-page pass.
 */
const toRecordPagePaths = (records: CollectionRecordIndex): readonly string[] =>
  [...records.values()]
    .flat()
    .map((entry) => entry.path)
    .filter((path) => !path.includes('/:'))

/**
 * Generate HTML files for single or multi-language apps
 */
function generateHtmlFiles(
  app: App,
  outputDir: string,
  replaceAppTokens: (app: App, lang: string) => App,
  services: {
    readonly serverFactory: ServerFactoryService['Service']
    readonly pageRenderer: PageRendererService['Service']
    readonly staticSiteGenerator: StaticSiteGeneratorService['Service']
  },
  recordPagePaths: readonly string[]
) {
  const { serverFactory, pageRenderer, staticSiteGenerator } = services
  return app.languages && app.pages
    ? generateMultiLanguageFiles(
        app,
        outputDir,
        replaceAppTokens,
        serverFactory,
        pageRenderer,
        staticSiteGenerator,
        recordPagePaths
      )
    : generateSingleLanguageFiles(
        app,
        outputDir,
        serverFactory,
        pageRenderer,
        staticSiteGenerator,
        recordPagePaths
      )
}

/**
 * Generate and write CSS file
 */
function generateCssFile(
  outputDir: string,
  app: App,
  cssCompiler: CSSCompilerService['Service'],
  fs: FileSystemLike,
  emitPrecompiledCss: boolean
) {
  return Effect.gen(function* () {
    logDebug('Getting compiled CSS...')
    const { css } = yield* cssCompiler.compile(app)

    // Write to static output directory (dist/assets/output.css), plus the
    // content-versioned twin the rendered HTML actually links.
    const cssFile = yield* writeCssFile(outputDir, css, fs, getVersionedCssFileName(app))

    if (!emitPrecompiledCss) {
      return cssFile
    }

    // Also write pre-compiled CSS for production start
    const precompiledPath = yield* writePrecompiledCSS(css).pipe(
      Effect.catch((error) =>
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
 * True for a file the build wrote for a listed record rather than a declared
 * page. `file` is relative to the output directory (`blog/pricing-change.html`,
 * or `en/blog/pricing-change.html` in a multi-language build, whose files sit
 * under their language directory while the record addresses do not).
 */
const isRecordPageFile =
  (recordPagePaths: ReadonlySet<string>, multiLanguage: boolean) =>
  (file: string): boolean => {
    const route = `/${file.replace(/\.html$/, '')}`
    if (recordPagePaths.has(route)) return true
    return multiLanguage && recordPagePaths.has(route.replace(/^\/[^/]+/, ''))
  }

/**
 * Optimize HTML files with formatting and transformations
 *
 * Record pages get the transformations (base path, hydration) but are not laid
 * out by Prettier. Formatting costs tens of milliseconds a page, so a table of
 * thousands of rows would spend minutes re-indenting whitespace; a browser and
 * a crawler read the page identically either way.
 *
 * @param generatedFiles - List of generated file paths
 * @param outputDir - Output directory path
 * @param options - Static generation options
 * @param fsModule - Filesystem module (Node.js fs/promises or Bun's equivalent)
 * @param isRecordPage - Whether a file is a listed record's page
 */
function optimizeHtmlFiles(
  generatedFiles: readonly string[],
  outputDir: string,
  options: GenerateStaticOptions,
  fsModule: FileSystemLike,
  isRecordPage: (file: string) => boolean
) {
  return Effect.gen(function* () {
    const formatted = generatedFiles.filter((file) => !isRecordPage(file))
    yield* formatHtmlFiles(formatted, outputDir, fsModule, path)
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
 * Generate all supporting files (sitemap, robots.txt, llms files, the `.md`
 * twins of content-directory articles, GitHub Pages files)
 */
function generateSupportingFiles(
  app: App,
  outputDir: string,
  options: GenerateStaticOptions,
  fs: FileSystemLike,
  collectionRecords: CollectionRecordIndex
) {
  return Effect.gen(function* () {
    const sitemapFiles = yield* generateSitemapFile(
      { app, collectionRecords },
      outputDir,
      options,
      fs
    )
    const robotsFiles = yield* generateRobotsFile(app, outputDir, options, fs)
    const llmsFiles = yield* generateLlmsFiles(app, outputDir, options, fs)
    const twinFiles = yield* generateMarkdownTwinFiles(app, outputDir, fs)
    const githubFiles = yield* generateGitHubPagesFiles(outputDir, options, fs)

    return [
      ...sitemapFiles,
      ...robotsFiles,
      ...llmsFiles,
      ...twinFiles,
      ...githubFiles,
    ] as readonly string[]
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
  // Raised when `IMAGE_TRANSFORM_PRESETS` is malformed, reached through the
  // server factory. It was MISSING from this union and the assertion at the end
  // of the function hid that: the generator could fail with an error its own
  // signature said it could not produce.
  | TransformPresetError
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

    // Step 4: Read the listed records once, then generate HTML files —
    // the declared pages plus one page per listed record
    const collectionRecords = yield* enumerateListedRecords(
      validatedApp,
      options,
      services.pageRenderer
    )
    const recordPagePaths = toRecordPagePaths(collectionRecords)
    const htmlFiles = yield* generateHtmlFiles(
      validatedApp,
      outputDir,
      replaceAppTokens,
      services,
      recordPagePaths
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
    yield* optimizeHtmlFiles(
      generatedFiles,
      outputDir,
      options,
      fs,
      isRecordPageFile(new Set(recordPagePaths), validatedApp.languages !== undefined)
    )

    // Step 7: Generate supporting files
    const supportingFiles = yield* generateSupportingFiles(
      validatedApp,
      outputDir,
      options,
      fs,
      collectionRecords
    )

    // Combine all files immutably
    const allFiles = [...generatedFiles, ...supportingFiles] as readonly string[]

    logDebug(`Generated ${allFiles.length} files to ${outputDir}`)

    return {
      outputDir,
      files: allFiles,
    }
  })

  // The declared return type above is the check; restating it as an assertion
  // here only made a mismatch invisible.
  return program.pipe(Effect.withSpan('server.generate-static'))
}
