/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import { PageRenderer } from '@/application/ports/services/page-renderer'
import { buildIslands } from '@/infrastructure/server/route-setup/static-assets'
import { renderErrorPage, renderNotFoundPage } from '@/presentation/rendering/render-error-pages'
import { renderPage } from '@/presentation/rendering/render-page'
import { renderRssFeed } from '@/presentation/rendering/render-rss-feed'
import type { DataSourceDb } from '@/presentation/rendering/data-source-resolver'
import type { Context } from 'effect'

function createDataSourceDbAdapter(repo: Context.Tag.Service<DataSourceRepository>): DataSourceDb {
  return {
    fetchRecords: (tableName, options) => Effect.runPromise(repo.fetchRecords(tableName, options)),
    countRecords: (tableName, filter) => Effect.runPromise(repo.countRecords(tableName, filter)),
    fetchSingleRecord: (tableName, paramField, paramValue, fields) =>
      Effect.runPromise(repo.fetchSingleRecord(tableName, paramField, paramValue, fields)),
    fetchUserAssignments: (userId, tableSlug) =>
      Effect.runPromise(repo.fetchUserAssignments(userId, tableSlug)),
    fetchUserAccessRoles: (userId) => Effect.runPromise(repo.fetchUserAccessRoles(userId)),
  }
}

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
