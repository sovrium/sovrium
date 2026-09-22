/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `GET /api/admin/tables/overview` route handler.
 *
 * Reads the live App configuration to discover the configured tables, runs
 * `buildTablesOverview` to produce the canonical response, validates it,
 * and emits a `table.overview.queried` audit-log entry on success.
 *
 * Auth gating is handled upstream by `requireAdminTier()` in `api-routes.ts`.
 */

import { Effect, Layer } from 'effect'
import { emitAuditEvent } from '@/application/use-cases/admin/audit-log/emit'
import { resolveActor } from '@/application/use-cases/admin/resolve-actor'
import { buildTablesOverview } from '@/application/use-cases/admin/tables-overview'
import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import {
  tablesOverviewQuerySchema,
  tablesOverviewResponseSchema,
} from '@/domain/models/api/admin/tables/overview'
import { decodeSafe } from '@/domain/models/api/combinators/decode'
import { TablesOverviewRepositoryLive } from '@/infrastructure/database/repositories/tables/tables-overview-repository-live'
import { logError } from '@/infrastructure/logging/logger'
import { runDomainPromise, runRequestEffect } from '@/infrastructure/logging/request-effect'
import { getSessionContext, requestLogAttributes } from '@/presentation/api/runtime/context-helpers'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/** Emit the `table.overview.queried` audit event for the calling session. */
async function emitTablesOverviewAudit(c: Context): Promise<void> {
  const session = getSessionContext(c)
  if (!session) return
  // `resolveActor` is the ONE place a session becomes an audit Actor, so this
  // endpoint records the same tier for a given user as every other emit site.
  const actor = await runDomainPromise(c, resolveActor(session.userId))
  await emitAuditEvent({
    action: 'table.overview.queried',
    actor,
    resourceId: 'overview',
    severity: 'info',
    result: 'success',
  })
}

/**
 * Build the handler factory bound to an App. The factory closes over `app` so
 * the handler can enumerate configured tables without re-importing the
 * runtime App state on every call.
 */
export function createHandleGetTablesOverview(app: App) {
  return async function handleGetTablesOverview(c: Context): Promise<Response> {
    const periodParam = c.req.query('period') ?? '24h'
    const parsedQuery = decodeSafe(tablesOverviewQuerySchema)({ period: periodParam })
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

    const exitEither = await runRequestEffect(c, program.pipe(Effect.result))
    if (exitEither._tag === 'Failure') {
      logError('[admin] tables/overview failed', exitEither.failure, requestLogAttributes(c))
      return c.json(
        { success: false, message: 'Failed to build tables overview', code: 'INTERNAL_ERROR' },
        500
      )
    }

    const parsed = decodeSafe(tablesOverviewResponseSchema)(exitEither.success)
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
