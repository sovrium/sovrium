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
  type ActivityLogWithUser,
} from '@/infrastructure/services/activity-log-service'

/**
 * Not found error when activity log doesn't exist
 */
export class ActivityLogNotFoundError extends Data.TaggedError('ActivityLogNotFoundError')<{
  readonly message: string
}> {}

/**
 * Invalid input error for invalid activity ID format
 */
export class InvalidActivityIdError extends Data.TaggedError('InvalidActivityIdError')<{
  readonly message: string
}> {}

/**
 * Input for GetActivityLogDetails use case
 */
export interface GetActivityLogDetailsInput {
  readonly activityId: string
}

/**
 * Activity log details output type for presentation layer
 *
 * Includes user metadata and properly formatted fields for API response.
 */
export interface ActivityLogDetailsOutput {
  readonly id: string
  readonly createdAt: string
  readonly userId: string | undefined
  readonly action: 'create' | 'update' | 'delete' | 'restore'
  readonly tableName: string
  readonly recordId: number
  readonly changes: Record<string, unknown> | null
  readonly user: {
    readonly id: string
    readonly name: string
    readonly email: string
  } | null
}

/**
 * Map infrastructure ActivityLogWithUser to application output
 */
function mapActivityLogDetails(log: Readonly<ActivityLogWithUser>): ActivityLogDetailsOutput {
  return {
    id: log.id,
    createdAt: log.createdAt.toISOString(),
    userId: log.userId ?? undefined,
    action: log.action,
    tableName: log.tableName,
    recordId: Number.parseInt(log.recordId, 10),
    changes: log.changes as Record<string, unknown> | null,
    user: log.user,
  }
}

/**
 * Get Activity Log Details Use Case
 *
 * Application layer use case that:
 * 1. Validates activityId is a valid UUID string
 * 2. Fetches activity log with user metadata
 * 3. Returns 404 if not found
 * 4. Maps to presentation-friendly format
 *
 * Follows layer-based architecture:
 * - Application Layer: This file (orchestration + business logic)
 * - Infrastructure Layer: ActivityLogService
 */
export const GetActivityLogDetails = (
  input: GetActivityLogDetailsInput
): Effect.Effect<
  ActivityLogDetailsOutput,
  ActivityLogNotFoundError | InvalidActivityIdError | ActivityLogDatabaseError,
  ActivityLogService
> =>
  Effect.gen(function* () {
    const activityLogService = yield* ActivityLogService

    const activityId = input.activityId.trim()

    // Validation: Accept UUID format or numeric strings, reject everything else
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const isUuid = uuidRegex.test(activityId)
    const isNumeric = /^[0-9]+$/.test(activityId)

    if (!activityId || (!isUuid && !isNumeric)) {
      return yield* new InvalidActivityIdError({
        message: 'Activity ID must be a valid UUID or numeric identifier',
      })
    }

    // Get activity log with user metadata
    const log = yield* activityLogService.getById(activityId)

    // Return 404 if not found
    if (!log) {
      return yield* new ActivityLogNotFoundError({
        message: 'Activity log not found',
      })
    }

    // Map to presentation-friendly format
    return mapActivityLogDetails(log)
  })

/**
 * Application Layer for Activity Log Details
 *
 * Provides ActivityLogService for the use case.
 */
export const GetActivityLogDetailsLayer = ActivityLogServiceLive
