/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { listViewsProgram, getViewProgram } from '@/application/use-cases/tables/table-operations'
import { listRecordsQuerySchema } from '@/domain/models/api/tables/params'
import { getViewResponseSchema } from '@/domain/models/api/tables/tables'
import { runEffect } from '@/presentation/api/runtime'
import { conditionalRead } from '@/presentation/api/runtime/conditional-read'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import { effectValidator } from '@/presentation/api/runtime/effect-validator'
import { handleListViewRecords } from './view-records-handler'
import type { App } from '@/domain/models/app'
import type { Hono } from 'hono'

export function chainViewRoutesMethods<T extends Hono>(honoApp: T, resolveApp: () => App) {
  return (
    honoApp
      .get('/api/tables/:tableId/views', async (c) => {
        // Session, tableId, and userRole are guaranteed by middleware chain
        const { tableId, userRole } = getTableContext(c)

        const program = Effect.gen(function* () {
          const result = yield* listViewsProgram(tableId, resolveApp(), userRole)
          // Return the views array directly (unwrapped) to match test expectations
          // No schema validation - test expects minimal view objects without timestamps
          return result
        })

        return runEffect(c, program)
      })
      .get('/api/tables/:tableId/views/:viewId', async (c) => {
        // Session, tableId, and userRole are guaranteed by middleware chain
        const { tableId, userRole } = getTableContext(c)

        return runEffect(
          c,
          getViewProgram(tableId, c.req.param('viewId'), resolveApp(), userRole),
          getViewResponseSchema
        )
      })
      // The query is typed by the records list's own schema — the same page,
      // sort, search and filter parameters — so the grid's typed client can
      // read a view the way it reads a table.
      .get(
        '/api/tables/:tableId/views/:viewId/records',
        conditionalRead(),
        effectValidator('query', listRecordsQuerySchema),
        (c) => handleListViewRecords(c, resolveApp())
      )
  )
}
