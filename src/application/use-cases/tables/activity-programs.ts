/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { ActivityRepository } from '@/application/ports/repositories/analytics/activity-repository'
import { NotFoundError } from '@/domain/errors'
import type { UserMetadataWithImage } from '@/application/ports/models/user-metadata'
import type { UserSession } from '@/application/ports/models/user-session'
import type { ActivityHistoryEntry } from '@/application/ports/repositories/analytics/activity-repository'
import type { DatabaseError } from '@/domain/errors'

/**
 * Get record history configuration
 */
interface GetRecordHistoryConfig {
  readonly session: Readonly<UserSession>
  readonly tableName: string
  readonly recordId: string
  readonly limit?: number
  readonly offset?: number
}

/**
 * Reader-exposed actor shape for a record-history entry.
 *
 * The record-history endpoint (`GET /api/tables/:tableId/records/:recordId/history`)
 * is authenticated-only — it does NOT gate on read-permission or admin role,
 * so a `viewer` who can reach the route would otherwise see the email of
 * every actor who touched the record. Drop `email` (B1): the history surface
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

/**
 * Format activity history entry for API response
 */
function formatActivityEntry(entry: ActivityHistoryEntry) {
  return {
    action: entry.action,
    createdAt: entry.createdAt.toISOString(),
    changes: entry.changes,
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
    const { session, tableName, recordId, limit, offset } = config

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
      history: entries.map(formatActivityEntry),
      pagination: {
        limit: resolvedLimit,
        offset: resolvedOffset,
        total,
      },
    }
  })
}
