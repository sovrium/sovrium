/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import { DataSourceRepository } from '@/application/ports/repositories/data-source-repository'
import { PageRenderer } from '@/application/ports/services/page-renderer'
import { buildIslands } from '@/infrastructure/server/route-setup/static-assets'
import { renderErrorPage, renderNotFoundPage } from '@/presentation/rendering/render-error-pages'
import { renderPage } from '@/presentation/rendering/render-page'
import { renderRssFeed } from '@/presentation/rendering/render-rss-feed'
import type { DataSourceDb } from '@/presentation/rendering/data-source-resolver'
import type { Context } from 'effect'

/**
 * Creates a DataSourceDb adapter from the Effect DataSourceRepository.
 *
 * Bridges the Effect-based repository (infrastructure layer) to the
 * plain async interface expected by the presentation rendering layer.
 */
function createDataSourceDbAdapter(repo: Context.Tag.Service<DataSourceRepository>): DataSourceDb {
  return {
    fetchRecords: (tableName, options) => Effect.runPromise(repo.fetchRecords(tableName, options)),
    countRecords: (tableName, filter) => Effect.runPromise(repo.countRecords(tableName, filter)),
    fetchSingleRecord: (tableName, paramField, paramValue, fields) =>
      Effect.runPromise(repo.fetchSingleRecord(tableName, paramField, paramValue, fields)),
    fetchUserAssignments: (userId, tableSlug) =>
      Effect.runPromise(repo.fetchUserAssignments(userId, tableSlug)),
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

    return {
      renderPage: (app, path, requestContext) =>
        renderPage(app, path, {
          ...(requestContext ?? {}),
          db,
          islandBuilder,
        }),
      renderNotFound: renderNotFoundPage,
      renderError: renderErrorPage,
      renderRssFeed: (app, baseUrl) => renderRssFeed(app, baseUrl, db),
    }
  })
)
