/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import { PageRenderer } from '@/application/ports/services/page-renderer'
import { getSovriumVersion } from '@/infrastructure/process/version'
import { buildIslands } from '@/infrastructure/server/route-setup/static-assets'
import { renderErrorPage, renderNotFoundPage } from '@/presentation/render/page/render-error-pages'
import { renderPage } from '@/presentation/render/page/render-page'
import { renderRssFeed } from '@/presentation/render/page/render-rss-feed'
import type { DataSourceDb } from '@/presentation/render/resolve/data-source-contracts'

/**
 * Creates a DataSourceDb adapter from the Effect DataSourceRepository.
 *
 * Bridges the Effect-based repository (infrastructure layer) to the
 * plain async interface expected by the presentation rendering layer.
 */
function createDataSourceDbAdapter(repo: DataSourceRepository['Service']): DataSourceDb {
  return {
    fetchRecords: (tableName, options) => Effect.runPromise(repo.fetchRecords(tableName, options)),
    countRecords: (tableName, filter) => Effect.runPromise(repo.countRecords(tableName, filter)),
    fetchSingleRecord: (tableName, paramField, paramValue, fields) =>
      Effect.runPromise(repo.fetchSingleRecord(tableName, paramField, paramValue, fields)),
    fetchUserAssignments: (userId, tableSlug) =>
      Effect.runPromise(repo.fetchUserAssignments(userId, tableSlug)),
    // Bug 2 / [internal ref]: overlay user_access roles onto the
    // Better Auth session role so page access checks see the engineer role.
    fetchUserAccessRoles: (userId) => Effect.runPromise(repo.fetchUserAccessRoles(userId)),
  }
}

/**
 * Live implementation of PageRenderer using React SSR
 *
 * This Layer provides production page rendering logic,
 * wrapping the presentation layer rendering functions in an
 * Effect Context service.
 *
 * Located in Infrastructure layer because Effect Layer "Live"
 * implementations are adapters (ports/adapters pattern).
 * Infrastructure adapters CAN depend on presentation utilities
 * for rendering logic.
 *
 * @example
 * ```typescript
 * // Provide PageRendererLive to use cases
 * const program = startServer(appConfig).pipe(
 *   Effect.provide(PageRendererLive)
 * )
 * ```
 */
export const PageRendererLive = Layer.effect(
  PageRenderer,
  Effect.gen(function* () {
    const dataSourceRepo = yield* DataSourceRepository
    const db = createDataSourceDbAdapter(dataSourceRepo)
    const islandBuilder = { buildIslands }
    // `$app.engineVersion` — the engine's OWN version, read ONCE while this
    // Layer is built (before the listener binds) and handed to every render.
    //
    // It is injected HERE rather than threaded from the two route funnels for
    // the reason it is a process constant: a value that cannot vary per request
    // should not travel on one, and the two funnels that would each have to
    // carry it are exactly the pair that has already diverged once over an
    // optional render input. Injecting it beside `db` and `islandBuilder` also
    // keeps `presentation/render/**` free of any `@/infrastructure/process`
    // import — it receives a string and asks no questions about where a version
    // comes from.
    // effect-promise: total -- `getSovriumVersion` falls back to the build-time define and wraps its `package.json` read in a try/catch, so it always resolves a string.
    const engineVersion = yield* Effect.promise(() => getSovriumVersion())

    return {
      renderPage: (app, path, requestContext) =>
        renderPage(app, path, {
          ...(requestContext ?? {}),
          db,
          islandBuilder,
          engineVersion,
        }),
      renderNotFound: renderNotFoundPage,
      renderError: renderErrorPage,
      renderRssFeed: (app, baseUrl) => renderRssFeed(app, baseUrl, db),
    }
  })
)
