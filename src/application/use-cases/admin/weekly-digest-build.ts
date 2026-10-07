/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Compute the weekly summary of the instance
 * over one period, compared with the previous summary when there is one.
 *
 * The figures come from the blocks in `weekly-digest-blocks.ts`, which cannot
 * fail; this module bounds them on the two remaining axes — how long each may
 * take (a slow source degrades to its zero value, like the admin overview) and
 * how many run at once (the database pool is shared with live traffic) — and
 * then assembles the version-1 document, change figures included.
 *
 * A BASELINE week is one with nothing to compare against: the first summary an
 * instance ever computes, or one whose predecessor's document this build can no
 * longer read. Every change figure is then null and `previous` is null.
 */

import { Effect } from 'effect'
import {
  buildAdminAttention,
  type AdminAttentionServices,
} from '@/application/use-cases/admin/attention'
import { withBlockTimeout } from '@/application/use-cases/admin/overview-block-timeout'
import {
  AUTOMATIONS_ZERO,
  auditErrorsBlock,
  automationsBlock,
  connectionsBlock,
  databaseBytesBlock,
  pausedBlock,
  storageBytesBlock,
  submissionsBlock,
  tablesBlock,
  uploadsBlock,
  usersBlock,
  versionChangesBlock,
  type DigestWindow,
  type TableFigures,
} from '@/application/use-cases/admin/weekly-digest-blocks'
import type { AuditLogRepository } from '@/application/ports/repositories/admin/audit-log-repository'
import type { BootLedgerRepository } from '@/application/ports/repositories/admin/boot-ledger-repository'
import type { AutomationRunOutcomeRepository } from '@/application/ports/repositories/automations/automation-run-outcome-repository'
import type { AdminBucketFilesRepository } from '@/application/ports/repositories/buckets/admin-bucket-files-repository'
import type { StorageFootprintRepository } from '@/application/ports/repositories/footprint/storage-footprint-repository'
import type { TablesOverviewRepository } from '@/application/ports/repositories/tables/tables-overview-repository'
import type { UsersOverviewRepository } from '@/application/ports/repositories/tables/users-overview-repository'
import type { StorageService } from '@/application/ports/services/storage-service'
import type { WeeklyDigest } from '@/domain/models/api/admin/notifications/weekly-digest'
import type { App } from '@/domain/models/app'

/** Every port the summary reads, as one name. All are carried by the server runtime. */
export type WeeklyDigestServices =
  | AdminAttentionServices
  | AutomationRunOutcomeRepository
  | TablesOverviewRepository
  | UsersOverviewRepository
  | AdminBucketFilesRepository
  | StorageService
  | StorageFootprintRepository
  | BootLedgerRepository
  | AuditLogRepository

/**
 * Per-block latency budget. The summary is a background job with no HTTP
 * ceiling above it, so the budget is wider than the overview's 8 s; it exists
 * so one hung source cannot hold the weekly email hostage.
 */
const BLOCK_TIMEOUT_MS = 20_000

/**
 * How many blocks read at once. Two, like the overview's nested fan-outs:
 * the summary shares the pool with whatever traffic is live when it runs.
 */
const BLOCK_CONCURRENCY = 2

/** What {@link buildWeeklyDigest} is told about the summary it compares against. */
export interface PreviousDigest {
  readonly periodEnd: Date
  /** `undefined` when the stored document is unreadable: the week is then a baseline. */
  readonly metrics: WeeklyDigest | undefined
}

/** Everything {@link buildWeeklyDigest} needs besides the app. */
export interface WeeklyDigestInput extends DigestWindow {
  readonly previous: PreviousDigest | undefined
  /** The operator timezone (IANA) the email renders the period in. */
  readonly timezone: string
  readonly engineVersion: string
}

/** The figures the blocks read, before any comparison. */
export interface DigestFigures {
  readonly automations: Omit<WeeklyDigest['automations'], 'paused'>
  readonly paused: WeeklyDigest['automations']['paused']
  readonly tables: readonly TableFigures[]
  readonly users: { readonly newUsers: number; readonly activeUsers: number }
  readonly submissions: number
  readonly uploads: WeeklyDigest['data']['uploads']
  readonly storageBytes: number
  readonly databaseBytes: number
  readonly connections: WeeklyDigest['system']['connections']
  readonly versionChanges: WeeklyDigest['system']['versionChanges']
  readonly errors: WeeklyDigest['system']['errors']
  readonly attention: WeeklyDigest['attention']
}

/** A change against the previous figure, or null on a baseline week. */
const change = (current: number, previous: number | undefined): number | null =>
  previous === undefined ? null : current - previous

/**
 * Assemble the version-1 document from the figures. PURE: the comparison with
 * the previous summary happens here, so it is testable without a database.
 * A table the previous summary did not know has no change figure.
 */
export const assembleWeeklyDigest = (
  app: App,
  input: WeeklyDigestInput,
  figures: DigestFigures
): WeeklyDigest => {
  const before = input.previous?.metrics
  const previousRows = new Map((before?.data.tables ?? []).map((table) => [table.name, table.rows]))
  return {
    v: 1,
    app: { name: app.name, version: app.version ?? null, engineVersion: input.engineVersion },
    period: {
      start: input.from.toISOString(),
      end: input.to.toISOString(),
      timezone: input.timezone,
      baseline: before === undefined,
    },
    automations: { ...figures.automations, paused: figures.paused },
    data: {
      tables: figures.tables.map((table) => ({
        name: table.name,
        rows: table.rows,
        rowsDelta: change(table.rows, previousRows.get(table.name)),
        written: table.written,
      })),
      newUsers: figures.users.newUsers,
      activeUsers: figures.users.activeUsers,
      submissions: figures.submissions,
      uploads: figures.uploads,
    },
    system: {
      databaseBytes: figures.databaseBytes,
      databaseBytesDelta: change(figures.databaseBytes, before?.system.databaseBytes),
      storageBytes: figures.storageBytes,
      storageBytesDelta: change(figures.storageBytes, before?.system.storageBytes),
      connections: figures.connections,
      versionChanges: figures.versionChanges,
      errors: figures.errors,
    },
    attention: figures.attention,
    previous:
      before === undefined || input.previous === undefined
        ? null
        : { periodEnd: input.previous.periodEnd.toISOString() },
  }
}

/** Bound a block by the summary's latency budget, degrading to `zero`. */
const bounded = <A, R>(block: Effect.Effect<A, never, R>, zero: A) =>
  withBlockTimeout(block, zero, BLOCK_TIMEOUT_MS)

const ATTENTION_ZERO: WeeklyDigest['attention'] = {
  unsetVariables: 0,
  expiredTokens: 0,
  pendingInvitations: 0,
}

/** What is waiting on an operator, from the console's own attention report. */
const attentionBlock = (
  app: App,
  from: Readonly<Date>
): Effect.Effect<WeeklyDigest['attention'], never, AdminAttentionServices> =>
  buildAdminAttention(app, from.toISOString()).pipe(
    Effect.map((report) => ({
      unsetVariables: report.variablesUnset,
      expiredTokens: report.tokensExpired,
      pendingInvitations: report.invitationsPending,
    }))
  )

/** Read every block, bounded in time and in concurrency. */
const readFigures = (
  app: App,
  window: DigestWindow
): Effect.Effect<DigestFigures, never, WeeklyDigestServices> =>
  Effect.gen(function* () {
    const zeroTables = (app.tables ?? []).map((table) => ({
      name: table.name,
      rows: 0,
      written: 0,
    }))
    const [automations, paused, tables, users, submissions, uploads] = yield* Effect.all(
      [
        bounded(automationsBlock(window), AUTOMATIONS_ZERO),
        bounded(pausedBlock(app), []),
        bounded(tablesBlock(app, window), zeroTables),
        bounded(usersBlock(window), { newUsers: 0, activeUsers: 0 }),
        bounded(submissionsBlock(app, window), 0),
        bounded(uploadsBlock(window), { files: 0, bytes: 0 }),
      ],
      { concurrency: BLOCK_CONCURRENCY }
    )
    const [storageBytes, databaseBytes, connections, versionChanges, errors, attention] =
      yield* Effect.all(
        [
          bounded(storageBytesBlock, 0),
          bounded(databaseBytesBlock, 0),
          bounded(connectionsBlock, { healthy: 0, total: 0 }),
          bounded(versionChangesBlock(app, window), []),
          bounded(auditErrorsBlock(window), []),
          bounded(attentionBlock(app, window.from), ATTENTION_ZERO),
        ],
        { concurrency: BLOCK_CONCURRENCY }
      )
    return {
      automations,
      paused,
      tables,
      users,
      submissions,
      uploads,
      storageBytes,
      databaseBytes,
      connections,
      versionChanges,
      errors,
      attention,
    }
  })

/**
 * Compute the weekly summary for `[from, to)`. Cannot fail and cannot hang:
 * every source degrades to its zero value, logged.
 */
export const buildWeeklyDigest = (
  app: App,
  input: WeeklyDigestInput
): Effect.Effect<WeeklyDigest, never, WeeklyDigestServices> =>
  readFigures(app, input).pipe(
    Effect.map((figures) => assembleWeeklyDigest(app, input, figures)),
    Effect.withSpan('notifications.build-weekly-digest')
  )
