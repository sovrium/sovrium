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
import { TablesOverviewRepository } from '@/application/ports/repositories/tables/tables-overview-repository'
import { StorageService } from '@/application/ports/services/storage-service'
import {
  AdminAutomationsLayer,
  BuildAutomationsOverview,
} from '@/application/use-cases/admin/automations-overview'
import {
  AdminConnectionsLayer,
  BuildConnectionsList,
} from '@/application/use-cases/admin/connections'
import { withBlockTimeout } from '@/application/use-cases/admin/overview-block-timeout'
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

const RECORDS_ZERO: { readonly total: number } = { total: 0 }
const SUBMISSIONS_ZERO: { readonly total: number } = { total: 0 }
const USERS_ZERO: { readonly total: number } = { total: 0 }
const RUNS_ZERO: { readonly recent: number; readonly successRate: number } = {
  recent: 0,
  successRate: 1,
}
const STORAGE_ZERO: { readonly totalBytes: number } = { totalBytes: 0 }
const CONNECTIONS_ZERO: { readonly total: number; readonly healthy: number } = {
  total: 0,
  healthy: 0,
}

const DEFAULT_BLOCK_TIMEOUT_MS = 8000
const parseBlockTimeoutMs = (raw: string | undefined): number => {
  const parsed = raw === undefined ? Number.NaN : Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_BLOCK_TIMEOUT_MS
}
const BLOCK_TIMEOUT_MS = parseBlockTimeoutMs(process.env.ADMIN_OVERVIEW_BLOCK_TIMEOUT_MS)

const recordsBlock = (app: App): Effect.Effect<{ readonly total: number }> => {
  const dbNames = (app.tables ?? []).map((t) => sanitizeTableName(t.name))
  return Effect.gen(function* () {
    const repo = yield* TablesOverviewRepository
    const counts = yield* repo.countLiveRows(dbNames)
    return { total: counts.reduce((acc, n) => acc + n, 0) }
  }).pipe(
    Effect.provide(TablesOverviewRepositoryLive),
    Effect.catchAll(() => Effect.succeed(RECORDS_ZERO))
  )
}

const usersBlock = (): Effect.Effect<{ readonly total: number }> =>
  BuildUsersOverview('24h').pipe(
    Effect.map((outcome) => ({
      total: outcome._tag === 'Ok' ? outcome.body.totals.users : 0,
    })),
    Effect.provide(UsersOverviewLayer),
    Effect.catchAll(() => Effect.succeed(USERS_ZERO))
  )

const runsBlock = (
  app: App
): Effect.Effect<{ readonly recent: number; readonly successRate: number }> =>
  BuildAutomationsOverview(app, '24h').pipe(
    Effect.map((outcome) =>
      outcome._tag === 'Ok'
        ? { recent: outcome.body.totals.runs_24h, successRate: outcome.body.totals.success_rate }
        : RUNS_ZERO
    ),
    Effect.provide(AdminAutomationsLayer),
    Effect.catchAll(() => Effect.succeed(RUNS_ZERO))
  )

const submissionsBlock = (app: App): Effect.Effect<{ readonly total: number }> => {
  const forms = app.forms ?? []
  return Effect.gen(function* () {
    const repo = yield* AdminFormsRepository
    const aggregates = yield* Effect.all(
      forms.map((form) => repo.aggregateForForm(form.name)),
      { concurrency: 2 }
    )
    const total = aggregates.reduce(
      (acc: number, agg: AdminFormAggregateRow) => acc + Number(agg.submissionCount ?? 0),
      0
    )
    return { total }
  }).pipe(
    Effect.provide(AdminFormsRepositoryLive),
    Effect.catchAll(() => Effect.succeed(SUBMISSIONS_ZERO))
  )
}

const storageBlock = (): Effect.Effect<{ readonly totalBytes: number }> =>
  Effect.gen(function* () {
    const storage = yield* StorageService
    const totalBytes = yield* storage.getTotalBytes()
    return { totalBytes }
  }).pipe(
    Effect.provide(StorageServiceLive),
    Effect.catchAll(() => Effect.succeed(STORAGE_ZERO))
  )

const connectionsBlock = (): Effect.Effect<{
  readonly total: number
  readonly healthy: number
}> =>
  BuildConnectionsList().pipe(
    Effect.map((outcome) => {
      if (outcome._tag !== 'Ok') return CONNECTIONS_ZERO
      const { connections } = outcome.body
      const healthy = connections.filter(
        (connection) => deriveConnectionStatus(connection.expiresAt) === 'active'
      ).length
      return { total: connections.length, healthy }
    }),
    Effect.provide(AdminConnectionsLayer),
    Effect.catchAll(() => Effect.succeed(CONNECTIONS_ZERO))
  )

export const buildAdminOverview = (app: App): Effect.Effect<AdminOverviewResponse> =>
  Effect.gen(function* () {
    const [records, submissions, runs, users, storage, connections] = yield* Effect.all(
      [
        withBlockTimeout(recordsBlock(app), RECORDS_ZERO, BLOCK_TIMEOUT_MS),
        withBlockTimeout(submissionsBlock(app), SUBMISSIONS_ZERO, BLOCK_TIMEOUT_MS),
        withBlockTimeout(runsBlock(app), RUNS_ZERO, BLOCK_TIMEOUT_MS),
        withBlockTimeout(usersBlock(), USERS_ZERO, BLOCK_TIMEOUT_MS),
        withBlockTimeout(storageBlock(), STORAGE_ZERO, BLOCK_TIMEOUT_MS),
        withBlockTimeout(connectionsBlock(), CONNECTIONS_ZERO, BLOCK_TIMEOUT_MS),
      ],
      { concurrency: 'unbounded' }
    )
    return { records, submissions, runs, users, storage, connections }
  })
