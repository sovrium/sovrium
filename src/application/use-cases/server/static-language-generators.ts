/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Schema } from 'effect'
import { AppValidationError } from '@/application/errors/app-validation-error'
import { languageOwnAddresses } from '@/domain/kernel/matching/localized-path'
import { AppSchema } from '@/domain/models/app'
import { getPublicPagePaths } from '@/domain/models/app/pages/public-pages'
import { withStaticBuildNavigation } from '@/domain/models/app/pages/static-build-navigation-service'
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
type ServerFactory = ServerFactoryService['Service']
type PageRenderer = PageRendererService['Service']
type StaticSiteGenerator = StaticSiteGeneratorService['Service']

// Every page below renders through `withStaticBuildNavigation`: a static host
// answers no partial request, so a sidebar that leaves `clientSideNavigation`
// out renders as off in a build, and only an explicit `true` keeps the swap.

/**
 * Generate static files for multi-language configuration
 */
export const generateMultiLanguageFiles = (
  validatedApp: App,
  outputDir: string,
  replaceAppTokens: (app: App, lang: string) => App,
  serverFactory: ServerFactory,
  pageRenderer: PageRenderer,
  staticSiteGenerator: StaticSiteGenerator,
  recordPagePaths: readonly string[] = []
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
    const languageCodes = supportedLanguages.map((language) => language.code)
    // Rewritten once for the whole pass: every language render and the root
    // index below start from the same build-mode app.
    const staticApp = withStaticBuildNavigation(validatedApp)

    // Generate files for each language using Effect.forEach
    const langFiles = yield* Effect.forEach(
      supportedLanguages,
      (lang) =>
        Effect.gen(function* () {
          logDebug(`Generating pages for language: ${lang.code}...`)

          // Replace tokens for this language
          const langApp = replaceAppTokens(staticApp, lang.code)

          // Validate the language-specific app
          const validatedLangApp = yield* Schema.decodeEffect(AppSchema)(langApp).pipe(
            Effect.mapError((error) => new AppValidationError(error))
          )

          // An app to render THIS language through, and no listener. The pass
          // drives `toSSG` over `app.fetch`, so a socket would be bound,
          // never connected to, and closed again (a CLI log output spec,
          const renderApp = yield* serverFactory.buildRenderApp({
            app: validatedLangApp,
            renderPage: pageRenderer.renderPage,
            renderNotFoundPage: pageRenderer.renderNotFound,
            renderErrorPage: pageRenderer.renderError,
          })

          // The pass writes from the output ROOT, each address as the server
          // serves it: a page naming no language under this language's prefix
          // (`/about` → `fr/about.html`), this language's own pages once at
          // their own address (`/fr/pricing` → `fr/pricing.html`), and another
          // language's pages not at all. Handing every pass every path and
          // writing into `<out>/<lang>` prefixed a path that already named a
          // language a second time (`fr/fr/pricing.html`, `en/fr/pricing.html`)
          // and wrote nothing at the address the sitemap and alternates give.
          // The crawl's non-page routes (assets, robots) land at the root too,
          // where the root pass below writes them last.
          // Filter to publicly-emittable pages — see getPublicPagePaths and
          // The pages public search requirement for the access-leak regression.
          const pagePaths = languageOwnAddresses(
            [...getPublicPagePaths(validatedLangApp.pages), ...recordPagePaths],
            lang.code,
            languageCodes
          )
          // Disposed AFTER the HTML exists, and on every exit path. The old
          // order was the reverse — the server was stopped BEFORE its `app`
          // reached the generator — which worked only because rendering never
          // needed the listener. It did need the domain runtime behind the app,
          // so releasing that first would not have been survivable.
          const ssgResult = yield* staticSiteGenerator
            .generate(renderApp.app, { outputDir, pagePaths })
            .pipe(Effect.ensuring(renderApp.dispose))

          return ssgResult.files
        }),
      // ONE RENDER APP AT A TIME, and the width is still the whole point.
      //
      // The original reason is gone and the width is not. Each iteration used
      // to boot a real server that ran the full `runDatabaseStartup` chain —
      // `initializeSchema`'s CREATE TABLEs, both reconcilers' ALTERs, the
      // seeder upserts, the JWKS rekey — against the operator's real database,
      // with no advisory lock anywhere in `src/infrastructure/database/`.
      // `'unbounded'` was N of those racing on a fresh database, which is a
      // corrupt schema rather than a failed assertion. The chain is hoisted out
      // of the pass now and runs once, before it.
      //
      // What each iteration still does is build a domain runtime: database
      // clients, the storage backend, whatever else the layer opens, held for
      // as long as that language takes to render. Widening this would multiply
      // those by the language count, on a pass that is boot-blocking anyway —
      // `startServer` runs it before the listener binds — so a single-language
      // app already pays exactly this shape, one render after another.
      { concurrency: 1 }
    )

    // Generate root index.html with default language
    logDebug('Generating root index.html with default language...')
    const defaultLang = validatedApp.languages!.default
    const defaultLangApp = replaceAppTokens(staticApp, defaultLang)
    const validatedDefaultApp = yield* Schema.decodeEffect(AppSchema)(defaultLangApp).pipe(
      Effect.mapError((error) => new AppValidationError(error))
    )

    const defaultRenderApp = yield* serverFactory.buildRenderApp({
      app: validatedDefaultApp,
      renderPage: pageRenderer.renderPage,
      renderNotFoundPage: pageRenderer.renderNotFound,
      renderErrorPage: pageRenderer.renderError,
    })

    // Generate only root index.html
    const rootSSGResult = yield* staticSiteGenerator
      .generate(defaultRenderApp.app, {
        outputDir,
        pagePaths: ['/'],
      })
      .pipe(Effect.ensuring(defaultRenderApp.dispose))

    // Every pass crawls the same non-page routes, so one file can be written by
    // several passes: listed once.
    return [...new Set([...langFiles.flat(), ...rootSSGResult.files])]
  }).pipe(Effect.withSpan('server.generate-multi-language-files'))

/**
 * Generate static files for single-language configuration
 */
export const generateSingleLanguageFiles = (
  validatedApp: App,
  outputDir: string,
  serverFactory: ServerFactory,
  pageRenderer: PageRenderer,
  staticSiteGenerator: StaticSiteGenerator,
  recordPagePaths: readonly string[] = []
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
    const renderApp = yield* serverFactory.buildRenderApp({
      app: withStaticBuildNavigation(validatedApp),
      renderPage: pageRenderer.renderPage,
      renderNotFoundPage: pageRenderer.renderNotFound,
      renderErrorPage: pageRenderer.renderError,
    })

    // Filter to publicly-emittable pages — see getPublicPagePaths and
    // The pages public search requirement for the access-leak regression.
    // The declared pages, plus one address per record the sitemap lists — the
    // record pages are written so a static host answers every listed address.
    const pagePaths = [...getPublicPagePaths(validatedApp.pages), ...recordPagePaths]
    logDebug(`[ssg] generating static HTML files for ${pagePaths.length} pages...`)
    const ssgResult = yield* staticSiteGenerator
      .generate(renderApp.app, {
        outputDir,
        pagePaths,
      })
      .pipe(Effect.ensuring(renderApp.dispose))
    return ssgResult.files
  }).pipe(Effect.withSpan('server.generate-single-language-files'))
