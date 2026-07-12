/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import {
  AdminFormsRepository,
  type AdminFormAggregateRow,
} from '@/application/ports/repositories/forms/admin-forms-repository'
import { StorageService } from '@/application/ports/services/storage-service'
import {
  AdminAutomationsLayer,
  BuildAutomationsOverview,
} from '@/application/use-cases/admin/automations-overview'
import {
  AdminConnectionsLayer,
  BuildConnectionsList,
} from '@/application/use-cases/admin/connections'
import { buildTablesOverview } from '@/application/use-cases/admin/tables-overview'
import {
  BuildUsersOverview,
  UsersOverviewLayer,
} from '@/application/use-cases/admin/users-overview'
import { deriveConnectionStatus } from '@/domain/services/admin/connection-status'
import { sanitizeTableName } from '@/domain/utils/database/table-naming'
import { AdminFormsRepositoryLive } from '@/infrastructure/database/repositories/forms/admin-forms-repository-live'
import { TablesOverviewRepositoryLive } from '@/infrastructure/database/repositories/tables/tables-overview-repository-live'
import { StorageServiceLive } from '@/infrastructure/storage/storage-service-live'
import type { AdminOverviewResponse } from '@/domain/models/api/admin/overview/overview'
import type { App } from '@/domain/models/app'

const recordsBlock = (app: App): Effect.Effect<{ readonly total: number }> => {
  const tables = (app.tables ?? []).map((t) => ({
    displayName: t.name,
    dbName: sanitizeTableName(t.name),
  }))
  return buildTablesOverview({ tables, period: '24h', now: new Date() }).pipe(
    Effect.map((overview) => ({ total: overview.totals.total_rows })),
    Effect.provide(TablesOverviewRepositoryLive),
    Effect.catchAll(() => Effect.succeed({ total: 0 }))
  )
}

const usersBlock = (): Effect.Effect<{ readonly total: number }> =>
  BuildUsersOverview('24h').pipe(
    Effect.map((outcome) => ({
      total: outcome._tag === 'Ok' ? outcome.body.totals.users : 0,
    })),
    Effect.provide(UsersOverviewLayer),
    Effect.catchAll(() => Effect.succeed({ total: 0 }))
  )

const runsBlock = (
  app: App
): Effect.Effect<{ readonly recent: number; readonly successRate: number }> =>
  BuildAutomationsOverview(app, '24h').pipe(
    Effect.map((outcome) =>
      outcome._tag === 'Ok'
        ? { recent: outcome.body.totals.runs_24h, successRate: outcome.body.totals.success_rate }
        : { recent: 0, successRate: 1 }
    ),
    Effect.provide(AdminAutomationsLayer),
    Effect.catchAll(() => Effect.succeed({ recent: 0, successRate: 1 }))
  )

const submissionsBlock = (app: App): Effect.Effect<{ readonly total: number }> => {
  const forms = app.forms ?? []
  return Effect.gen(function* () {
    const repo = yield* AdminFormsRepository
    const aggregates = yield* Effect.all(
      forms.map((form) => repo.aggregateForForm(form.name)),
      { concurrency: 'unbounded' }
    )
    const total = aggregates.reduce(
      (acc: number, agg: AdminFormAggregateRow) => acc + Number(agg.submissionCount ?? 0),
      0
    )
    return { total }
  }).pipe(
    Effect.provide(AdminFormsRepositoryLive),
    Effect.catchAll(() => Effect.succeed({ total: 0 }))
  )
}

const storageBlock = (): Effect.Effect<{ readonly totalBytes: number }> =>
  Effect.gen(function* () {
    const storage = yield* StorageService
    const totalBytes = yield* storage.getTotalBytes()
    return { totalBytes }
  }).pipe(
    Effect.provide(StorageServiceLive),
    Effect.catchAll(() => Effect.succeed({ totalBytes: 0 }))
  )

const connectionsBlock = (): Effect.Effect<{
  readonly total: number
  readonly healthy: number
}> =>
  BuildConnectionsList().pipe(
    Effect.map((outcome) => {
      if (outcome._tag !== 'Ok') return { total: 0, healthy: 0 }
      const { connections } = outcome.body
      const healthy = connections.filter(
        (connection) => deriveConnectionStatus(connection.expiresAt) === 'active'
      ).length
      return { total: connections.length, healthy }
    }),
    Effect.provide(AdminConnectionsLayer),
    Effect.catchAll(() => Effect.succeed({ total: 0, healthy: 0 }))
  )

export const buildAdminOverview = (app: App): Effect.Effect<AdminOverviewResponse> =>
  Effect.gen(function* () {
    const [records, submissions, runs, users, storage, connections] = yield* Effect.all(
      [
        recordsBlock(app),
        submissionsBlock(app),
        runsBlock(app),
        usersBlock(),
        storageBlock(),
        connectionsBlock(),
      ],
      { concurrency: 'unbounded' }
    )
    return { records, submissions, runs, users, storage, connections }
  })
