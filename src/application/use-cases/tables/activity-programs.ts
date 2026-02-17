/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { ActivityRepository } from '@/application/ports/repositories/activity-repository'
import { SessionContextError } from '@/domain/errors'
import type { UserSession } from '@/application/ports/models/user-session'
import type { ActivityHistoryEntry } from '@/application/ports/repositories/activity-repository'

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
 * Format activity history entry for API response
 */
function formatActivityEntry(entry: ActivityHistoryEntry) {
  return {
    action: entry.action,
    createdAt: entry.createdAt.toISOString(),
    changes: entry.changes,
    user: entry.user,
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
      readonly user:
        | {
            readonly id: string
            readonly name: string
            readonly email: string
            readonly image: string | null
          }
        | undefined
    }[]
    readonly pagination: {
      readonly limit: number
      readonly offset: number
      readonly total: number
    }
  },
  SessionContextError,
  ActivityRepository
> {
  return Effect.gen(function* () {
    const activityRepo = yield* ActivityRepository
    const { session, tableName, recordId, limit, offset } = config

    // Check if record exists before fetching history
    const recordExists = yield* activityRepo.checkRecordExists({ session, tableName, recordId })
    if (!recordExists) {
      return yield* Effect.fail(new SessionContextError('Record not found'))
    }

    // Fetch activity history with pagination
    const { entries, total } = yield* activityRepo.getRecordHistory({
      session,
      tableName,
      recordId,
      limit,
      offset,
    })

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
