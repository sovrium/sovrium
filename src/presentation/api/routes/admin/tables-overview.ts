/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect, Layer } from 'effect'
import { emitAuditEvent } from '@/application/use-cases/admin/audit-log/emit'
import { buildTablesOverview } from '@/application/use-cases/admin/tables-overview'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import {
  tablesOverviewQuerySchema,
  tablesOverviewResponseSchema,
} from '@/domain/models/api/admin/tables/overview'
import { sanitizeTableName } from '@/domain/utils/table-naming'
import { TablesOverviewRepositoryLive } from '@/infrastructure/database/repositories/tables-overview-repository-live'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

async function emitTablesOverviewAudit(c: Context): Promise<void> {
  const session = getSessionContext(c)
  if (!session) return
  const role = await getUserRole(session.userId)
  await emitAuditEvent({
    action: 'table.overview.queried',
    actor: {
      id: session.userId,
      type: 'user',
      role: role === 'admin' ? 'admin' : 'operator',
    },
    resourceId: 'overview',
    severity: 'info',
    result: 'success',
  })
}

export function createHandleGetTablesOverview(app: App) {
  return async function handleGetTablesOverview(c: Context): Promise<Response> {
    const periodParam = c.req.query('period') ?? '24h'
    const parsedQuery = tablesOverviewQuerySchema.safeParse({ period: periodParam })
    if (!parsedQuery.success) {
      return c.json(
        { success: false, message: 'Invalid period query parameter', code: 'VALIDATION_ERROR' },
        400
      )
    }

    const tables = (app.tables ?? []).map((t) => ({
      displayName: t.name,
      dbName: sanitizeTableName(t.name),
    }))

    const program = buildTablesOverview({
      tables,
      period: parsedQuery.data.period,
      now: new Date(),
    }).pipe(Effect.provide(Layer.merge(TablesOverviewRepositoryLive, Layer.empty)))

    const exitEither = await Effect.runPromise(program.pipe(Effect.either))
    if (exitEither._tag === 'Left') {
      console.error('[admin] tables/overview failed', exitEither.left)
      return c.json(
        { success: false, message: 'Failed to build tables overview', code: 'INTERNAL_ERROR' },
        500
      )
    }

    const parsed = tablesOverviewResponseSchema.safeParse(exitEither.right)
    if (!parsed.success) {
      return c.json(
        { success: false, message: 'Failed to validate response', code: 'INTERNAL_ERROR' },
        500
      )
    }

    await emitTablesOverviewAudit(c)

    c.header('Cache-Control', 'no-store')
    return c.json(parsed.data, 200)
  }
}
