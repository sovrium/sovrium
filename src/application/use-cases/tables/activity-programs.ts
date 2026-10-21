/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { ActivityRepository } from '@/application/ports/repositories/analytics/activity-repository'
import { NotFoundError } from '@/domain/errors'
import { filterChangesReadableByAny } from '@/domain/models/app/tables/field-read-filter-service'
import { callersOfRow } from '@/domain/models/app/tables/row-read-admission-service'
import { readerRowsOf } from './row-read-admission'
import type { UserMetadataWithImage } from '@/application/ports/contracts/user-metadata'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { ActivityHistoryEntry } from '@/application/ports/repositories/analytics/activity-repository'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type { DatabaseError } from '@/domain/errors'
import type { App } from '@/domain/models/app'

/**
 * Get record history configuration
 */
interface GetRecordHistoryConfig {
  readonly session: Readonly<UserSession>
  readonly tableName: string
  readonly recordId: string
  readonly limit?: number
  readonly offset?: number
  /** `desc` reads newest first; absent (or `asc`) keeps oldest first. */
  readonly sortOrder?: 'asc' | 'desc'
  /**
   * The app and the caller's role, which decide the fields a history entry may
   * show. A history entry IS the record's values, before and after, so it is
   * projected exactly as a read of the record is — a field the caller cannot
   * read is dropped from both sides.
   */
  readonly app: App
  readonly userRole: string
  /** The caller's groups: a field read grant may name a group. */
  readonly userGroups?: readonly string[]
}

/**
 * Reader-exposed actor shape for a record-history entry.
 *
 * The record-history endpoint (`GET /api/tables/:tableId/records/:recordId/history`)
 * is open to any caller who may read the record, so a `viewer` who can reach
 * the route would otherwise see the email of every actor who touched the
 * record. Drop `email` (B1): the history surface
 * only needs an id + display name + avatar to attribute a change. The shared
 * `UserMetadataWithImage` port keeps email for legit consumers; it is only
 * projected away at this response boundary.
 */
interface HistoryActor {
  readonly id: string
  readonly name: string
  readonly image: string | null | undefined
}

/**
 * Project the full actor metadata down to the reader-safe history actor,
 * dropping `email`.
 */
function toHistoryActor(user: UserMetadataWithImage | undefined): HistoryActor | undefined {
  return user ? { id: user.id, name: user.name, image: user.image } : undefined
}

/** A logged change set as the caller may read it (`filterChangesReadableByAny`). */
type ChangesReader = (changes: unknown) => unknown

/**
 * Every side of a change as a list of the row shows the caller: under her
 * role and each role a grant gives her on that row. A write-only field stays
 * named, masked, as the history recorded it.
 */
const changesReaderOf = (
  config: GetRecordHistoryConfig
): Effect.Effect<ChangesReader, never, DataSourceRepository> => {
  const { app, tableName, session, recordId } = config
  const caller = { role: config.userRole, groups: config.userGroups ?? [] }
  return readerRowsOf(app, tableName, { ...caller, session }).pipe(
    Effect.map(({ grants }) => {
      const callers = callersOfRow(caller, grants, recordId)
      return (changes: unknown) => filterChangesReadableByAny({ app, tableName, callers, changes })
    })
  )
}

/**
 * Format activity history entry for API response
 */
function formatActivityEntry(entry: ActivityHistoryEntry, readable: ChangesReader) {
  return {
    action: entry.action,
    createdAt: entry.createdAt.toISOString(),
    changes: readable(entry.changes),
    user: toHistoryActor(entry.user),
    // Flat, so a page's row template can print it; null when no person made it
    userName: entry.user?.name ?? null,
  }
}

/**
 * Get record history program
 */
export function getRecordHistoryProgram(config: GetRecordHistoryConfig): Effect.Effect<
  {
    readonly history: readonly {
      readonly action: string
      readonly createdAt: string
      readonly changes: unknown
      readonly user: HistoryActor | undefined
      readonly userName: string | null
    }[]
    readonly total: number
    readonly pagination: {
      readonly limit: number
      readonly offset: number
      readonly total: number
    }
  },
  DatabaseError | NotFoundError,
  ActivityRepository | DataSourceRepository
> {
  return Effect.gen(function* () {
    const activityRepo = yield* ActivityRepository
    const { session, tableName, recordId, limit, offset } = config
    const readable = yield* changesReaderOf(config)

    // Check if record exists in the table (handles live records)
    const recordExists = yield* activityRepo.checkRecordExists({ session, tableName, recordId })

    // Fetch activity history with pagination (needed even for deleted records)
    const { entries, total } = yield* activityRepo.getRecordHistory({
      session,
      tableName,
      recordId,
      limit,
      offset,
      sortOrder: config.sortOrder,
    })

    // If record doesn't exist in table AND has no activity logs, it truly doesn't exist
    if (!recordExists && total === 0) {
      return yield* Effect.fail(new NotFoundError('Record not found'))
    }

    // Resolve pagination values (default: all results)
    const resolvedLimit = limit ?? total
    const resolvedOffset = offset ?? 0

    // Format response
    return {
      history: entries.map((entry) => formatActivityEntry(entry, readable)),
      total,
      pagination: {
        limit: resolvedLimit,
        offset: resolvedOffset,
        total,
      },
    }
  }).pipe(Effect.withSpan('tables.get-record-history-program'))
}
