/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  listViewsResponseSchema,
  getViewResponseSchema,
  getViewRecordsResponseSchema,
} from '@/presentation/api/schemas/tables-schemas'
import { runEffect } from '@/presentation/api/utils'
import { listViewsProgram, getViewProgram, getViewRecordsProgram } from './programs'
import type { Hono } from 'hono'

export function chainViewRoutesMethods<T extends Hono>(honoApp: T) {
  return honoApp
    .get('/api/tables/:tableId/views', async (c) =>
      runEffect(c, listViewsProgram(), listViewsResponseSchema)
    )
    .get('/api/tables/:tableId/views/:viewId', async (c) =>
      runEffect(
        c,
        getViewProgram(c.req.param('tableId'), c.req.param('viewId')),
        getViewResponseSchema
      )
    )
    .get('/api/tables/:tableId/views/:viewId/records', async (c) =>
      runEffect(c, getViewRecordsProgram(), getViewRecordsResponseSchema)
    )
}
