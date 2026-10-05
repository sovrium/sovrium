/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { ActivityRepository } from '@/application/ports/repositories/analytics/activity-repository'
import { NotFoundError } from '@/domain/errors'
import { filterReadableFields } from '@/domain/models/app/tables/field-read-filter-service'
import type { UserMetadataWithImage } from '@/application/ports/contracts/user-metadata'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { ActivityHistoryEntry } from '@/application/ports/repositories/analytics/activity-repository'
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

type FieldReader = (values: Readonly<Record<string, unknown>>) => Readonly<Record<string, unknown>>

const isValueMap = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Project a logged change set down to the fields the caller may read: every
 * value map it carries (`before`, `after`) keeps only readable fields. Any
 * other shape passes through, since it names no field.
 */
function projectChanges(changes: unknown, readable: FieldReader): unknown {
  if (!isValueMap(changes)) return changes
  return Object.fromEntries(
    Object.entries(changes).map(([side, values]) => [
      side,
      isValueMap(values) ? readable(values) : values,
    ])
  )
}

/**
 * Format activity history entry for API response
 */
function formatActivityEntry(entry: ActivityHistoryEntry, readable: FieldReader) {
  return {
    action: entry.action,
    createdAt: entry.createdAt.toISOString(),
    changes: projectChanges(entry.changes, readable),
    user: toHistoryActor(entry.user),
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
    }[]
    readonly pagination: {
      readonly limit: number
      readonly offset: number
      readonly total: number
    }
  },
  DatabaseError | NotFoundError,
  ActivityRepository
> {
  return Effect.gen(function* () {
    const activityRepo = yield* ActivityRepository
    const { session, tableName, recordId, limit, offset, app, userRole } = config
    const caller = { role: userRole, groups: config.userGroups ?? [] }
    const readable: FieldReader = (record) =>
      filterReadableFields({ app, tableName, caller, record })

    // Check if record exists in the table (handles live records)
    const recordExists = yield* activityRepo.checkRecordExists({ session, tableName, recordId })

    // Fetch activity history with pagination (needed even for deleted records)
    const { entries, total } = yield* activityRepo.getRecordHistory({
      session,
      tableName,
      recordId,
      limit,
      offset,
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
      pagination: {
        limit: resolvedLimit,
        offset: resolvedOffset,
        total,
      },
    }
  }).pipe(Effect.withSpan('tables.get-record-history-program'))
}
