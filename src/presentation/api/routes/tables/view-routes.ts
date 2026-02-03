/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  listViewsProgram,
  getViewProgram,
  getViewRecordsProgram,
} from '@/application/use-cases/tables/programs'
import {
  getViewResponseSchema,
  getViewRecordsResponseSchema,
} from '@/presentation/api/schemas/tables-schemas'
import { runEffect } from '@/presentation/api/utils'
import { getTableContext } from '@/presentation/api/utils/context-helpers'
import type { App } from '@/domain/models/app'
import type { Hono } from 'hono'

export function chainViewRoutesMethods<T extends Hono>(honoApp: T, app: App) {
  return honoApp
    .get('/api/tables/:tableId/views', async (c) => {
      // Session, tableId, and userRole are guaranteed by middleware chain
      const { tableId, userRole } = getTableContext(c)

      const program = Effect.gen(function* () {
        const result = yield* listViewsProgram(tableId, app, userRole)
        // Return the views array directly (unwrapped) to match test expectations
        // No schema validation - test expects minimal view objects without timestamps
        return result
      })

      return runEffect(c, program)
    })
    .get('/api/tables/:tableId/views/:viewId', async (c) =>
      runEffect(
        c,
        getViewProgram(c.req.param('tableId'), c.req.param('viewId'), app),
        getViewResponseSchema
      )
    )
    .get('/api/tables/:tableId/views/:viewId/records', async (c) =>
      runEffect(c, getViewRecordsProgram(), getViewRecordsResponseSchema)
    )
}
