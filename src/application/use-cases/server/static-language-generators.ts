/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable max-params, max-lines-per-function -- Complex multi-language generators require explicit dependencies */

import { Effect, Console, Schema, type Context } from 'effect'
import { AppValidationError } from '@/application/errors/app-validation-error'
import { AppSchema } from '@/domain/models/app'
import type { CSSCompilationError } from '@/application/ports/css-compiler'
import type { PageRenderer as PageRendererService } from '@/application/ports/page-renderer'
import type { ServerFactory as ServerFactoryService } from '@/application/ports/server-factory'
import type {
  SSGGenerationError,
  StaticSiteGenerator as StaticSiteGeneratorService,
} from '@/application/ports/static-site-generator'
import type { App } from '@/domain/models/app'
import type { AuthConfigRequiredForUserFields } from '@/infrastructure/errors/auth-config-required-error'
import type { SchemaInitializationError } from '@/infrastructure/errors/schema-initialization-error'
import type { ServerCreationError } from '@/infrastructure/errors/server-creation-error'

// Service types extracted from Context.Tag
type ServerFactory = Context.Tag.Service<ServerFactoryService>
type PageRenderer = Context.Tag.Service<PageRendererService>
type StaticSiteGenerator = Context.Tag.Service<StaticSiteGeneratorService>

/**
 * Generate static files for multi-language configuration
 */
export const generateMultiLanguageFiles = (
  validatedApp: App,
  outputDir: string,
  replaceAppTokens: (app: App, lang: string) => App,
  serverFactory: ServerFactory,
  pageRenderer: PageRenderer,
  staticSiteGenerator: StaticSiteGenerator
): Effect.Effect<
  readonly string[],
  | AppValidationError
  | CSSCompilationError
  | ServerCreationError
  | SSGGenerationError
  | AuthConfigRequiredForUserFields
  | SchemaInitializationError,
  never
> =>
  Effect.gen(function* () {
    yield* Console.log(`🌍 Generating multi-language static site...`)
    const supportedLanguages = validatedApp.languages!.supported

    // Generate files for each language using Effect.forEach
    const langFiles = yield* Effect.forEach(
      supportedLanguages,
      (lang) =>
        Effect.gen(function* () {
          yield* Console.log(`📝 Generating pages for language: ${lang.code}...`)

          // Replace tokens for this language
          const langApp = replaceAppTokens(validatedApp, lang.code)

          // Validate the language-specific app
          const validatedLangApp = yield* Effect.try({
            try: (): App => Schema.decodeUnknownSync(AppSchema)(langApp),
            catch: (error) => new AppValidationError(error),
          })

          // Create server instance for this language
          const serverInstance = yield* serverFactory.create({
            app: validatedLangApp,
            port: 0,
            hostname: 'localhost',
            renderHomePage: pageRenderer.renderHome,
            renderPage: pageRenderer.renderPage,
            renderNotFoundPage: pageRenderer.renderNotFound,
            renderErrorPage: pageRenderer.renderError,
          })

          yield* serverInstance.stop

          // Generate static files in language subdirectory
          const langOutputDir = `${outputDir}/${lang.code}`
          // Filter out underscore-prefixed pages (admin/internal pages)
          const pagePaths =
            validatedLangApp.pages
              ?.filter((page) => !page.path.startsWith('/_'))
              .map((page) => page.path) || []
          const ssgResult = yield* staticSiteGenerator.generate(serverInstance.app, {
            outputDir: langOutputDir,
            pagePaths,
          })

          // Return files with language prefix (normalize paths to be relative)
          return ssgResult.files.map((f) => {
            // toSSG returns relative paths from the outputDir
            // Simply prefix with language code
            return `${lang.code}/${f}`
          })
        }),
      { concurrency: 'unbounded' }
    )

    // Generate root index.html with default language
    yield* Console.log(`📝 Generating root index.html with default language...`)
    const defaultLang = validatedApp.languages!.default
    const defaultLangApp = replaceAppTokens(validatedApp, defaultLang)
    const validatedDefaultApp = yield* Effect.try({
      try: (): App => Schema.decodeUnknownSync(AppSchema)(defaultLangApp),
      catch: (error) => new AppValidationError(error),
    })

    const defaultServer = yield* serverFactory.create({
      app: validatedDefaultApp,
      port: 0,
      hostname: 'localhost',
      renderHomePage: pageRenderer.renderHome,
      renderPage: pageRenderer.renderPage,
      renderNotFoundPage: pageRenderer.renderNotFound,
      renderErrorPage: pageRenderer.renderError,
    })

    yield* defaultServer.stop

    // Generate only root index.html
    const rootSSGResult = yield* staticSiteGenerator.generate(defaultServer.app, {
      outputDir,
      pagePaths: ['/'],
    })

    // Combine all files immutably
    return [...langFiles.flat(), ...rootSSGResult.files]
  })

/**
 * Generate static files for single-language configuration
 */
export const generateSingleLanguageFiles = (
  validatedApp: App,
  outputDir: string,
  serverFactory: ServerFactory,
  pageRenderer: PageRenderer,
  staticSiteGenerator: StaticSiteGenerator
): Effect.Effect<
  readonly string[],
  | CSSCompilationError
  | ServerCreationError
  | SSGGenerationError
  | AuthConfigRequiredForUserFields
  | SchemaInitializationError,
  never
> =>
  Effect.gen(function* () {
    // No multi-language - generate normally
    yield* Console.log('🏗️  Creating application instance...')
    const serverInstance = yield* serverFactory.create({
      app: validatedApp,
      port: 0,
      hostname: 'localhost',
      renderHomePage: pageRenderer.renderHome,
      renderPage: pageRenderer.renderPage,
      renderNotFoundPage: pageRenderer.renderNotFound,
      renderErrorPage: pageRenderer.renderError,
    })

    yield* serverInstance.stop

    // Filter out underscore-prefixed pages (admin/internal pages)
    const pagePaths =
      validatedApp.pages?.filter((page) => !page.path.startsWith('/_')).map((page) => page.path) ||
      []
    yield* Console.log(`📝 Generating static HTML files for ${pagePaths.length} pages...`)
    const ssgResult = yield* staticSiteGenerator.generate(serverInstance.app, {
      outputDir,
      pagePaths,
    })
    return ssgResult.files
  })
