/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { validateTable, enrichUserRole } from '@/presentation/api/middleware/table'
import { chainBatchRoutesMethods } from './batch-routes'
import { chainRecordRoutesMethods } from './record-routes'
import { chainTableRoutesMethods } from './table-routes'
import { handleCreateUserAccessRecord, handleListUserAccessRecords } from './user-access-handlers'
import { chainViewRoutesMethods } from './view-routes'
import type { App } from '@/domain/models/app'
import type { Context, Hono, Next } from 'hono'

async function guestContextHandler(c: Context, next: Next) {
  const guestSession = {
    userId: 'guest',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    token: '',
    ipAddress: '',
    userAgent: '',
  }
  c.set('session', guestSession)
  c.set('userRole', 'guest')
  c.set('userGroups', [] as readonly string[])

  await next()
}

function provideGuestContext() {
  return guestContextHandler
}

export function chainTableRoutes<T extends Hono<any, any, any>>(
  honoApp: T,
  app: App,
  resolveApp: () => App = () => app
) {
  const honoWithUserAccess = honoApp
    .post('/api/tables/user_access/records', (c) => handleCreateUserAccessRecord(c, resolveApp()))
    .get('/api/tables/user_access/records', (c) => handleListUserAccessRecords(c, resolveApp()))

  const honoWithMiddleware = app.auth
    ? honoWithUserAccess
        .use('/api/tables/:tableId', validateTable(resolveApp))
        .use('/api/tables/:tableId', enrichUserRole())
        .use('/api/tables/:tableId/*', validateTable(resolveApp))
        .use('/api/tables/:tableId/*', enrichUserRole())
    : honoWithUserAccess
        .use('/api/tables/:tableId', validateTable(resolveApp))
        .use('/api/tables/:tableId', provideGuestContext())
        .use('/api/tables/:tableId/*', validateTable(resolveApp))
        .use('/api/tables/:tableId/*', provideGuestContext())

  return chainViewRoutesMethods(
    chainRecordRoutesMethods(
      chainBatchRoutesMethods(chainTableRoutesMethods(honoWithMiddleware, resolveApp), resolveApp),
      resolveApp
    ),
    resolveApp
  )
}
