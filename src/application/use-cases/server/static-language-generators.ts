/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Console, Schema, type Context } from 'effect'
import { AppValidationError } from '@/application/errors/app-validation-error'
import { AppSchema } from '@/domain/models/app'
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

type ServerFactory = Context.Tag.Service<ServerFactoryService>
type PageRenderer = Context.Tag.Service<PageRendererService>
type StaticSiteGenerator = Context.Tag.Service<StaticSiteGeneratorService>

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
    yield* Console.log(`🌍 Generating multi-language static site...`)
    const supportedLanguages = validatedApp.languages!.supported

    const langFiles = yield* Effect.forEach(
      supportedLanguages,
      (lang) =>
        Effect.gen(function* () {
          yield* Console.log(`📝 Generating pages for language: ${lang.code}...`)

          const langApp = replaceAppTokens(validatedApp, lang.code)

          const validatedLangApp = yield* Schema.decodeUnknown(AppSchema)(langApp).pipe(
            Effect.mapError((error) => new AppValidationError(error))
          )

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

          const langOutputDir = `${outputDir}/${lang.code}`
          const pagePaths =
            validatedLangApp.pages
              ?.filter((page) => !page.path.startsWith('/_'))
              .map((page) => page.path) || []
          const ssgResult = yield* staticSiteGenerator.generate(serverInstance.app, {
            outputDir: langOutputDir,
            pagePaths,
          })

          return ssgResult.files.map((f) => {
            return `${lang.code}/${f}`
          })
        }),
      { concurrency: 'unbounded' }
    )

    yield* Console.log(`📝 Generating root index.html with default language...`)
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

    const rootSSGResult = yield* staticSiteGenerator.generate(defaultServer.app, {
      outputDir,
      pagePaths: ['/'],
    })

    return [...langFiles.flat(), ...rootSSGResult.files]
  })

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
    yield* Console.log('🏗️  Creating application instance...')
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
