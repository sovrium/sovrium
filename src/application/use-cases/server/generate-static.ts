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

export interface GenerateStaticOptions {
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
  readonly publicDir?: string
}

export interface GenerateStaticResult {
  readonly outputDir: string
  readonly files: readonly string[]
}

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
        yield* Console.log('🔍 Validating app schema...')
        return yield* Schema.decodeUnknown(AppSchema)(app).pipe(
          Effect.mapError((error) => new AppValidationError(error))
        )
      })
}

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

function generateCssFile(
  outputDir: string,
  app: App,
  cssCompiler: Context.Tag.Service<CSSCompilerService>,
  fs: FileSystemLike
) {
  return Effect.gen(function* () {
    yield* Console.log('🎨 Getting compiled CSS...')
    const { css } = yield* cssCompiler.compile(app)

    const cssFile = yield* writeCssFile(outputDir, css, fs)

    const precompiledPath = yield* writePrecompiledCSS(css).pipe(
      Effect.catchAll((error) =>
        Console.log(`⚠️ Could not write pre-compiled CSS: ${error}`).pipe(Effect.as(undefined))
      )
    )
    if (precompiledPath) {
      yield* Console.log(`📦 Pre-compiled CSS written to ${precompiledPath}`)
    }

    return cssFile
  })
}

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
    const { replaceAppTokens } = translationReplacer

    const validatedApp = yield* validateAppSchema(app)

    const services = yield* getServicesFromContext()
    const outputDir = options.outputDir || './static'

    const htmlFiles = yield* generateHtmlFiles(
      validatedApp,
      outputDir,
      replaceAppTokens,
      services.serverFactory,
      services.pageRenderer,
      services.staticSiteGenerator
    )

    const cssFile = yield* generateCssFile(outputDir, validatedApp, services.cssCompiler, fs)
    const hydrationFiles = yield* generateHydrationFiles(outputDir, options.hydration ?? false, fs)
    const assetFiles = yield* copyPublicAssets(options.publicDir, outputDir)

    const generatedFiles = [
      ...htmlFiles,
      cssFile,
      ...hydrationFiles,
      ...assetFiles,
    ] as readonly string[]

    yield* optimizeHtmlFiles(generatedFiles, outputDir, options, fs)

    const supportingFiles = yield* generateSupportingFiles(validatedApp, outputDir, options, fs)

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
