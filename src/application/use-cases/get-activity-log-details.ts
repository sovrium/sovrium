/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// eslint-disable-next-line no-restricted-syntax -- Activity logs are a cross-cutting concern, not phase-specific
import { Data, Effect } from 'effect'
import {
  ActivityLogService,
  ActivityLogServiceLive,
  type ActivityLogDatabaseError,
  type ActivityLogNotFoundError,
} from '@/infrastructure/services/activity-log-service'
import type { ActivityLogChanges } from '@/infrastructure/database/drizzle/schema/activity-log'

/**
 * Invalid activity ID format error
 */
export class InvalidActivityIdError extends Data.TaggedError('InvalidActivityIdError')<{
  readonly id: string
}> {}

/**
 * Input for GetActivityLogDetails use case
 */
export interface GetActivityLogDetailsInput {
  readonly activityId: string
}

/**
 * Activity log details output for presentation layer
 */
export interface ActivityLogDetailsOutput {
  readonly id: string
  readonly createdAt: string
  readonly userId: string | null
  readonly action: 'create' | 'update' | 'delete' | 'restore'
  readonly tableName: string
  readonly recordId: number
  readonly changes: ActivityLogChanges | null
  readonly user: {
    readonly id: string
    readonly name: string
    readonly email: string
  } | null
}

/**
 * Get Activity Log Details Use Case
 *
 * Application layer use case that:
 * 1. Validates activity ID format
 * 2. Fetches activity log with user details
 * 3. Maps to presentation-friendly format
 */
export const GetActivityLogDetails = (
  input: GetActivityLogDetailsInput
): Effect.Effect<
  ActivityLogDetailsOutput,
  InvalidActivityIdError | ActivityLogNotFoundError | ActivityLogDatabaseError,
  ActivityLogService
> =>
  Effect.gen(function* () {
    const activityLogService = yield* ActivityLogService

    // Validate activity ID format (must be valid UUID or numeric ID)
    // PostgreSQL UUIDs or integer IDs are expected
    const isValidId =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.activityId) ||
      /^\d+$/.test(input.activityId)

    if (!isValidId) {
      return yield* new InvalidActivityIdError({ id: input.activityId })
    }

    // Fetch activity log with user details
    const log = yield* activityLogService.findById(input.activityId)

    // Map to presentation-friendly format
    return {
      id: log.id,
      createdAt: log.createdAt.toISOString(),
      // eslint-disable-next-line unicorn/no-null -- Database returns null, preserve for API consistency
      userId: log.userId ?? null,
      action: log.action,
      tableName: log.tableName,
      recordId: Number(log.recordId),
      // eslint-disable-next-line unicorn/no-null -- Database returns null, preserve for API consistency
      changes: log.changes ?? null,
      user: log.user
        ? {
            id: log.user.id,
            name: log.user.name,
            email: log.user.email,
          }
        : // eslint-disable-next-line unicorn/no-null -- Database returns null, preserve for API consistency
          null,
    }
  })

/**
 * Application Layer for Activity Log Details
 */
export const GetActivityLogDetailsLayer = ActivityLogServiceLive
