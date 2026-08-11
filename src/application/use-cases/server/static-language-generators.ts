/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Schema, type Context } from 'effect'
import { AppValidationError } from '@/application/errors/app-validation-error'
import { AppSchema } from '@/domain/models/app'
import { getPublicPagePaths } from '@/domain/models/app/pages/public-pages'
import { logDebug } from '@/infrastructure/logging'
import type { CSSCompilationError } from '@/application/ports/services/css-compiler'
import type { PageRenderer as PageRendererService } from '@/application/ports/services/page-renderer'
import type { ServerFactory as ServerFactoryService } from '@/application/ports/services/server-factory'
import type {
  SSGGenerationError,
  StaticSiteGenerator as StaticSiteGeneratorService,
} from '@/application/ports/services/static-site-generator'
import type { App } from '@/domain/models/app'
import type { AuthConfigRequiredForUserFields } from '@/infrastructure/errors/auth-config-required-error'
import type { SchemaInitializationError } from '@/infrastructure/errors/schema-initialization-error'
import type { ServerCreationError } from '@/infrastructure/errors/server-creation-error'
import type { TransformPresetError } from '@/infrastructure/errors/transform-preset-error'

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
  | SchemaInitializationError
  | TransformPresetError
  | Error,
  never
> =>
  Effect.gen(function* () {
    logDebug('[ssg] generating multi-language static site...')
    const supportedLanguages = validatedApp.languages!.supported

    // Generate files for each language using Effect.forEach
    // eslint-disable-next-line sovrium/no-unbounded-promise-fanout -- build-time static generation: filesystem/SSG work on a dedicated process, no shared database pool connection is held.
    const langFiles = yield* Effect.forEach(
      supportedLanguages,
      (lang) =>
        Effect.gen(function* () {
          logDebug(`Generating pages for language: ${lang.code}...`)

          // Replace tokens for this language
          const langApp = replaceAppTokens(validatedApp, lang.code)

          // Validate the language-specific app
          const validatedLangApp = yield* Schema.decodeUnknown(AppSchema)(langApp).pipe(
            Effect.mapError((error) => new AppValidationError(error))
          )

          // Create server instance for this language
          const serverInstance = yield* serverFactory.create({
            app: validatedLangApp,
            port: 0,
            hostname: 'localhost',
            silent: true,
            renderPage: pageRenderer.renderPage,
            renderNotFoundPage: pageRenderer.renderNotFound,
            renderErrorPage: pageRenderer.renderError,
          })

          yield* serverInstance.stop

          // Generate static files in language subdirectory
          const langOutputDir = `${outputDir}/${lang.code}`
          // Filter to publicly-emittable pages — see getPublicPagePaths and
          // [internal ref] for the access-leak regression.
          const pagePaths = getPublicPagePaths(validatedLangApp.pages)
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
    logDebug('Generating root index.html with default language...')
    const defaultLang = validatedApp.languages!.default
    const defaultLangApp = replaceAppTokens(validatedApp, defaultLang)
    const validatedDefaultApp = yield* Schema.decodeUnknown(AppSchema)(defaultLangApp).pipe(
      Effect.mapError((error) => new AppValidationError(error))
    )

    const defaultServer = yield* serverFactory.create({
      app: validatedDefaultApp,
      port: 0,
      hostname: 'localhost',
      silent: true,
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
  | SchemaInitializationError
  | TransformPresetError
  | Error,
  never
> =>
  Effect.gen(function* () {
    // No multi-language - generate normally
    logDebug('Creating application instance...')
    const serverInstance = yield* serverFactory.create({
      app: validatedApp,
      port: 0,
      hostname: 'localhost',
      silent: true,
      renderPage: pageRenderer.renderPage,
      renderNotFoundPage: pageRenderer.renderNotFound,
      renderErrorPage: pageRenderer.renderError,
    })

    yield* serverInstance.stop

    // Filter to publicly-emittable pages — see getPublicPagePaths and
    // [internal ref] for the access-leak regression.
    const pagePaths = getPublicPagePaths(validatedApp.pages)
    logDebug(`[ssg] generating static HTML files for ${pagePaths.length} pages...`)
    const ssgResult = yield* staticSiteGenerator.generate(serverInstance.app, {
      outputDir,
      pagePaths,
    })
    return ssgResult.files
  })
