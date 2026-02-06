/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import {
  ActivityLogService,
  ActivityLogServiceLive,
  type ActivityLogDatabaseError,
} from '@/infrastructure/services/activity-log-service'

/**
 * Record not found error
 */
export class RecordNotFoundError extends Data.TaggedError('RecordNotFoundError')<{
  readonly message: string
}> {}

/**
 * Input for GetRecordHistory use case
 */
export interface GetRecordHistoryInput {
  readonly tableName: string
  readonly recordId: string
  readonly limit?: number
  readonly offset?: number
  readonly checkRecordExists?: boolean
}

/**
 * Activity history entry output
 */
export interface HistoryEntryOutput {
  readonly id: string
  readonly action: 'create' | 'update' | 'delete' | 'restore'
  readonly changes:
    | {
        readonly before?: Record<string, unknown>
        readonly after?: Record<string, unknown>
      }
    | null
    | undefined
  readonly createdAt: string
  readonly user:
    | {
        readonly id: string
        readonly name: string
        readonly email: string
        readonly image: string | undefined
      }
    | undefined
}

/**
 * Get Record History output
 */
export interface GetRecordHistoryOutput {
  readonly history: readonly HistoryEntryOutput[]
  readonly pagination?: {
    readonly limit: number
    readonly offset: number
    readonly total: number
  }
}

/**
 * Get Record History Use Case
 *
 * Fetches chronological change history for a specific record with user metadata.
 * Applies 1-year retention policy filter.
 */
export const GetRecordHistory = (
  input: GetRecordHistoryInput
): Effect.Effect<
  GetRecordHistoryOutput,
  RecordNotFoundError | ActivityLogDatabaseError,
  ActivityLogService
> =>
  Effect.gen(function* () {
    const activityLogService = yield* ActivityLogService

    // Fetch activity logs with user metadata
    const result = yield* activityLogService.getRecordHistory({
      tableName: input.tableName,
      recordId: input.recordId,
      limit: input.limit,
      offset: input.offset,
      checkRecordExists: input.checkRecordExists,
    })

    // Format history response
    const history: readonly HistoryEntryOutput[] = result.logs.map((log) => ({
      id: log.id,
      action: log.action,
      changes: log.changes,
      createdAt: log.createdAt.toISOString(),
      user: log.userId
        ? {
            id: log.userId,
            name: log.userName ?? 'Unknown',
            email: log.userEmail ?? '',
            image: log.userImage,
          }
        : undefined,
    }))

    return {
      history,
      pagination: input.limit
        ? {
            limit: input.limit,
            offset: input.offset ?? 0,
            total: result.total,
          }
        : undefined,
    }
  })

/**
 * Application Layer for Get Record History
 */
export const GetRecordHistoryLayer = ActivityLogServiceLive
