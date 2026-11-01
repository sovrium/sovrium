/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { listViewsProgram, getViewProgram } from '@/application/use-cases/tables/table-operations'
import { listRecordsQuerySchema } from '@/domain/models/api/tables/params'
import { getViewResponseSchema, listViewsResponseSchema } from '@/domain/models/api/tables/tables'
import { conditionalRead } from '@/presentation/api/runtime/conditional-read'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import { effectValidator } from '@/presentation/api/runtime/effect-validator'
import { respondWith, runHandlerEffect } from '@/presentation/api/runtime/run-effect'
import { refuseTableWithNoReaderRow } from './readable-table-gate'
import { servesRecordLanguage } from './record-read-language'
import { resolveTableReadCaller } from './table-read-caller'
import { handleListViewRecords } from './view-records-handler'
import type { App } from '@/domain/models/app'
import type { Hono } from 'hono'

export function chainViewRoutesMethods<T extends Hono>(honoApp: T, app: App) {
  return (
    honoApp
      .get('/api/tables/:tableId/views', refuseTableWithNoReaderRow(app), (c) => {
        // Session, tableId, and userRole are guaranteed by middleware chain
        const { session, tableName, tableId, userRole, userGroups } = getTableContext(c)
        return runHandlerEffect(
          c,
          respondWith(
            c,
            Effect.flatMap(
              resolveTableReadCaller(app, { session, tableName, userRole, userGroups }),
              (caller) => listViewsProgram(tableId, app, caller)
            ),
            listViewsResponseSchema
          )
        )
      })
      .get('/api/tables/:tableId/views/:viewId', refuseTableWithNoReaderRow(app), (c) => {
        // Session, tableId, and userRole are guaranteed by middleware chain
        const { session, tableName, tableId, userRole, userGroups } = getTableContext(c)
        return runHandlerEffect(
          c,
          respondWith(
            c,
            Effect.flatMap(
              resolveTableReadCaller(app, { session, tableName, userRole, userGroups }),
              (caller) => getViewProgram(tableId, c.req.param('viewId')!, app, caller)
            ),
            getViewResponseSchema
          )
        )
      })
      // The query is typed by the records list's own schema — the same page,
      // sort, search and filter parameters — so the grid's typed client can
      // read a view the way it reads a table.
      .get(
        '/api/tables/:tableId/views/:viewId/records',
        // A table whose list admits the caller no row answers as a missing
        // one before the view is asked anything — a row rule matching nothing
        // included.
        refuseTableWithNoReaderRow(app),
        conditionalRead(),
        effectValidator('query', listRecordsQuerySchema),
        // Translatable fields are served in the reader's language, as on the records list.
        servesRecordLanguage(app),
        (c) => handleListViewRecords(c, app)
      )
  )
}
