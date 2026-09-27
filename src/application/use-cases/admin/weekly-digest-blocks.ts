/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The reads behind the weekly summary,
 * one block per section, each over the half-open period `[from, to)`.
 *
 * Every block follows the admin overview's discipline (`overview.ts`): it
 * DECLARES the port it reads, and it cannot fail — a source that errors is
 * logged with its cause and degrades to its zero value. The latency half of
 * that discipline (`withBlockTimeout`) is applied by the caller, which also
 * bounds how many blocks run at once. A summary with one grey line is still a
 * summary; a summary that never arrives because one query failed is not.
 *
 * COUNTS ONLY. No block reads a record value, an account's email or name, or
 * a submission body; the one free text is the first line of a failing
 * automation's last error, which the run store has already redacted.
 */

import { Cause, Data, Effect } from 'effect'
import { BootLedgerRepository } from '@/application/ports/repositories/admin/boot-ledger-repository'
import { AutomationPauseRepository } from '@/application/ports/repositories/automations/automation-pause-repository'
import { AutomationRunOutcomeRepository } from '@/application/ports/repositories/automations/automation-run-outcome-repository'
import { AdminBucketFilesRepository } from '@/application/ports/repositories/buckets/admin-bucket-files-repository'
import { StorageFootprintRepository } from '@/application/ports/repositories/footprint/storage-footprint-repository'
import { AdminFormsRepository } from '@/application/ports/repositories/forms/admin-forms-repository'
import { TablesOverviewRepository } from '@/application/ports/repositories/tables/tables-overview-repository'
import { UsersOverviewRepository } from '@/application/ports/repositories/tables/users-overview-repository'
import { StorageService } from '@/application/ports/services/storage-service'
import { BuildConnectionsList } from '@/application/use-cases/admin/connections'
import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import { coerceTimestampToMs } from '@/domain/kernel/time/time-series-bucketing'
import { deriveConnectionStatus } from '@/domain/models/app/admin/connection-status'
import { summariseRunError } from '@/domain/models/app/automations/failure-summary-service'
import { countAuditEntriesByAction } from '@/infrastructure/audit-log/drizzle-store'
import { Logger } from '@/infrastructure/logging/logger'
import type { ConnectionRepository } from '@/application/ports/repositories/connections/connection-repository'
import type { ConnectionTokenRepository } from '@/application/ports/repositories/connections/connection-token-repository'
import type { WeeklyDigest } from '@/domain/models/api/admin/notifications/weekly-digest'
import type { App } from '@/domain/models/app'

/** The half-open period a block reads. */
export interface DigestWindow {
  readonly from: Date
  readonly to: Date
}

type Automations = Omit<WeeklyDigest['automations'], 'paused'>
type Paused = WeeklyDigest['automations']['paused']
type Connections = WeeklyDigest['system']['connections']
type VersionChanges = WeeklyDigest['system']['versionChanges']
type AuditErrors = WeeklyDigest['system']['errors']

/** A table's live rows and the distinct rows written in the period, by config name. */
export interface TableFigures {
  readonly name: string
  readonly rows: number
  readonly written: number
}

/** How many failing automations the summary names, and the error cap. */
const TOP_FAILING_LIMIT = 5
const LAST_ERROR_MAX_LENGTH = 200

/** The severities the summary's error line counts. */
const ERROR_SEVERITIES = ['error', 'critical'] as const

/**
 * Log WHY a block degraded, ahead of the fallback that swallows it — so the
 * summary still goes out and the reason survives.
 */
const logBlockFailure =
  (block: string) =>
  (cause: Cause.Cause<unknown>): Effect.Effect<void, never, Logger> =>
    Effect.gen(function* () {
      const logger = yield* Logger
      yield* logger.error(
        `Weekly summary block '${block}' degraded to its zero value`,
        Cause.squash(cause),
        { 'sovrium.admin.weekly-digest.block': block }
      )
    })

/** Degrade a block to `zero`, logging the cause first (E6). */
const orZero =
  <A>(block: string, zero: A) =>
  <E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, never, R | Logger> =>
    effect.pipe(
      Effect.tapCause(logBlockFailure(block)),
      // effect-swallow: logged above; the summary reports a zero line rather than not arriving.
      Effect.orElseSucceed(() => zero)
    )

/** An error as the summary prints it — see `summariseRunError` — or null when there is none. */
const summarisedLastError = (error: string | undefined): string | null => {
  const line = error === undefined ? '' : summariseRunError(error, LAST_ERROR_MAX_LENGTH)
  // eslint-disable-next-line unicorn/no-null -- the wire contract spells "no error" as null
  return line === '' ? null : line
}

export const AUTOMATIONS_ZERO: Automations = {
  runs: 0,
  failures: 0,
  timedOut: 0,
  interrupted: 0,
  // eslint-disable-next-line unicorn/no-null -- "nothing ran" is null on the wire
  successRate: null,
  topFailing: [],
}

/** Runs, failures and the automations that failed most in the period. */
export const automationsBlock = (
  window: DigestWindow
): Effect.Effect<Automations, never, AutomationRunOutcomeRepository | Logger> =>
  Effect.gen(function* () {
    const repository = yield* AutomationRunOutcomeRepository
    const tallies = yield* repository.countRunsByAutomationBetween(window)
    const sum = (pick: (tally: (typeof tallies)[number]) => number): number =>
      tallies.reduce((total, tally) => total + pick(tally), 0)
    const runs = sum((tally) => tally.runs)
    const failures = sum((tally) => tally.failed)
    const failing = tallies
      .filter((tally) => tally.failed > 0)
      .toSorted((a, b) => b.failed - a.failed || a.automationName.localeCompare(b.automationName))
      .slice(0, TOP_FAILING_LIMIT)
    const topFailing = yield* Effect.forEach(failing, (tally) =>
      repository.findLastFailureError({ automationName: tally.automationName, ...window }).pipe(
        Effect.map((error) => ({
          name: tally.automationName,
          failures: tally.failed,
          lastError: summarisedLastError(error),
        }))
      )
    )
    return {
      runs,
      failures,
      timedOut: sum((tally) => tally.timedOut),
      interrupted: sum((tally) => tally.interrupted),
      // eslint-disable-next-line unicorn/no-null -- "nothing ran" is null on the wire
      successRate: runs === 0 ? null : (runs - failures) / runs,
      topFailing,
    }
  }).pipe(
    orZero('automations', AUTOMATIONS_ZERO),
    Effect.withSpan('notifications.weekly-digest.automations')
  )

/** Every automation the app declares that is paused now, automatic pauses marked. */
export const pausedBlock = (
  app: App
): Effect.Effect<Paused, never, AutomationPauseRepository | Logger> =>
  Effect.gen(function* () {
    const declared = new Set((app.automations ?? []).map((automation) => automation.name))
    const pauses = yield* (yield* AutomationPauseRepository).listPauses
    return pauses
      .filter((pause) => declared.has(pause.automationName))
      .map((pause) => ({
        name: pause.automationName,
        automatic: pause.reason === 'consecutive-failures',
        since: new Date(coerceTimestampToMs(pause.pausedAt)).toISOString(),
      }))
      .toSorted((a, b) => a.name.localeCompare(b.name))
  }).pipe(orZero('paused', [] as Paused), Effect.withSpan('notifications.weekly-digest.paused'))

/** Every declared table: its live rows and the distinct rows written in the period. */
export const tablesBlock = (
  app: App,
  window: DigestWindow
): Effect.Effect<readonly TableFigures[], never, TablesOverviewRepository | Logger> => {
  const names = (app.tables ?? []).map((table) => table.name)
  const zero = names.map((name) => ({ name, rows: 0, written: 0 }))
  return Effect.gen(function* () {
    const repository = yield* TablesOverviewRepository
    const dbNames = names.map((name) => sanitizeTableName(name))
    const rows = yield* repository.countLiveRows(dbNames)
    const written = yield* repository.countWritesPerTable(dbNames, window.from, window.to)
    return names.map((name, index) => ({
      name,
      rows: rows[index] ?? 0,
      written: written[index] ?? 0,
    }))
  }).pipe(orZero('tables', zero), Effect.withSpan('notifications.weekly-digest.tables'))
}

/** Accounts created in the period, and accounts that held a session in it. */
export const usersBlock = (
  window: DigestWindow
): Effect.Effect<
  { readonly newUsers: number; readonly activeUsers: number },
  never,
  UsersOverviewRepository | Logger
> =>
  Effect.gen(function* () {
    const repository = yield* UsersOverviewRepository
    const users = yield* repository.listUserRows
    const from = window.from.getTime()
    const to = window.to.getTime()
    const newUsers = users.filter((user) => {
      const created = coerceTimestampToMs(user.createdAt)
      return created >= from && created < to
    }).length
    const activeUsers = yield* repository.countActiveUsersSince(window.from)
    return { newUsers, activeUsers }
  }).pipe(
    orZero('users', { newUsers: 0, activeUsers: 0 }),
    Effect.withSpan('notifications.weekly-digest.users')
  )

/** Form submissions received in the period, across every declared form. */
export const submissionsBlock = (
  app: App,
  window: DigestWindow
): Effect.Effect<number, never, AdminFormsRepository | Logger> =>
  Effect.gen(function* () {
    const repository = yield* AdminFormsRepository
    const to = window.to.getTime()
    const perForm = yield* Effect.forEach(
      app.forms ?? [],
      (form) =>
        repository
          .listSubmissionsSince(form.name, window.from)
          .pipe(
            Effect.map(
              (rows) => rows.filter((row) => coerceTimestampToMs(row.submittedAt) < to).length
            )
          ),
      { concurrency: 2 }
    )
    return perForm.reduce((total, count) => total + count, 0)
  }).pipe(orZero('submissions', 0), Effect.withSpan('notifications.weekly-digest.submissions'))

/** Files stored in the period, and their bytes. */
export const uploadsBlock = (
  window: DigestWindow
): Effect.Effect<
  { readonly files: number; readonly bytes: number },
  never,
  AdminBucketFilesRepository | Logger
> =>
  Effect.gen(function* () {
    const repository = yield* AdminBucketFilesRepository
    return yield* repository.summariseUploadsBetween(window)
  }).pipe(
    orZero('uploads', { files: 0, bytes: 0 }),
    Effect.withSpan('notifications.weekly-digest.uploads')
  )

/** Bytes held in file storage now. */
export const storageBytesBlock: Effect.Effect<number, never, StorageService | Logger> = Effect.gen(
  function* () {
    const storage = yield* StorageService
    return yield* storage.getTotalBytes
  }
).pipe(orZero('storage', 0), Effect.withSpan('notifications.weekly-digest.storage'))

/** The size of the whole database now. */
export const databaseBytesBlock: Effect.Effect<number, never, StorageFootprintRepository | Logger> =
  Effect.gen(function* () {
    const repository = yield* StorageFootprintRepository
    const footprint = yield* repository.measureDatabaseFootprint([])
    return footprint.totalBytes
  }).pipe(orZero('database', 0), Effect.withSpan('notifications.weekly-digest.database'))

/** How many declared connections report a healthy status now. */
export const connectionsBlock: Effect.Effect<
  Connections,
  never,
  ConnectionRepository | ConnectionTokenRepository | Logger
> = BuildConnectionsList.pipe(
  Effect.map((outcome) => {
    if (outcome._tag !== 'Ok') return { healthy: 0, total: 0 }
    const { connections } = outcome.body
    const healthy = connections.filter(
      (connection) => deriveConnectionStatus(connection.expiresAt) === 'active'
    ).length
    return { healthy, total: connections.length }
  }),
  orZero('connections', { healthy: 0, total: 0 }),
  Effect.withSpan('notifications.weekly-digest.connections')
)

/** The engine version changes the boot ledger recorded in the period, oldest first. */
export const versionChangesBlock = (
  app: App,
  window: DigestWindow
): Effect.Effect<VersionChanges, never, BootLedgerRepository | Logger> =>
  Effect.gen(function* () {
    const entries = yield* (yield* BootLedgerRepository).listNewestFirst(app.name)
    return entries
      .filter(
        (entry) =>
          entry.bootedAt >= window.from &&
          entry.bootedAt < window.to &&
          entry.prevEngineVersion !== undefined &&
          entry.prevEngineVersion !== entry.engineVersion
      )
      .toReversed()
      .map((entry) => ({
        at: entry.bootedAt.toISOString(),
        from: entry.prevEngineVersion ?? '',
        to: entry.engineVersion,
      }))
  }).pipe(
    orZero('version-changes', [] as VersionChanges),
    Effect.withSpan('notifications.weekly-digest.version-changes')
  )

/** The audit store could not be read; the block reports zero entries instead. */
class AuditErrorsReadError extends Data.TaggedError('AuditErrorsReadError')<{
  readonly cause: unknown
}> {}

/** Error and critical audit entries of the period, by action, most first. */
export const auditErrorsBlock = (window: DigestWindow): Effect.Effect<AuditErrors, never, Logger> =>
  Effect.tryPromise({
    try: () =>
      countAuditEntriesByAction({
        since: window.from,
        until: window.to,
        severities: ERROR_SEVERITIES,
        limit: TOP_FAILING_LIMIT,
      }),
    catch: (cause) => new AuditErrorsReadError({ cause }),
  }).pipe(
    orZero('audit-errors', [] as AuditErrors),
    Effect.withSpan('notifications.weekly-digest.audit-errors')
  )
