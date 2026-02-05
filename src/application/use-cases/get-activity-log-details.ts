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
  ActivityLogNotFoundError,
} from '@/infrastructure/services/activity-log-service'

// Re-export for presentation layer
export { ActivityLogNotFoundError }

/**
 * Invalid activity ID format error
 */
export class InvalidActivityIdError extends Data.TaggedError('InvalidActivityIdError')<{
  readonly activityId: string
  readonly message: string
}> {}

/**
 * Input for GetActivityLogDetails use case
 */
export interface GetActivityLogDetailsInput {
  readonly activityId: string
  readonly userId: string // For future permission checks
}

/**
 * Activity log details output type for presentation layer
 */
export interface ActivityLogDetailsOutput {
  readonly id: string
  readonly userId: string | undefined
  readonly action: 'create' | 'update' | 'delete' | 'restore'
  readonly tableName: string
  readonly recordId: number
  readonly changes: Record<string, unknown> | null
  readonly createdAt: string
  readonly user?: {
    readonly id: string
    readonly name: string
    readonly email: string
  }
}

/**
 * Validate activity ID format
 *
 * Activity IDs should be valid UUIDs (text format in database)
 */
function validateActivityId(activityId: string): Effect.Effect<string, InvalidActivityIdError> {
  // For now, just check it's not empty
  // UUID validation can be added later if needed
  if (!activityId || activityId.trim() === '') {
    return Effect.fail(
      new InvalidActivityIdError({
        activityId,
        message: 'Activity ID cannot be empty',
      })
    )
  }

  return Effect.succeed(activityId)
}

/**
 * Get Activity Log Details Use Case
 *
 * Application layer use case that:
 * 1. Validates activity ID format
 * 2. Fetches activity log with user metadata
 * 3. Maps to presentation-friendly format
 *
 * Follows layer-based architecture:
 * - Application Layer: This file (orchestration + business logic)
 * - Infrastructure Layer: ActivityLogService
 * - Domain Layer: Validation rules
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

    // Validate activity ID format
    const validatedId = yield* validateActivityId(input.activityId)

    // Fetch activity log with user metadata
    const activityLog = yield* activityLogService.findById(validatedId)

    // Parse recordId as integer (stored as text in database)
    const recordId = parseInt(activityLog.recordId, 10)

    // Map to presentation-friendly format
    return {
      id: activityLog.id,
      userId: activityLog.userId ?? undefined,
      action: activityLog.action,
      tableName: activityLog.tableName,
      recordId,
      changes: activityLog.changes as Record<string, unknown> | null,
      createdAt: activityLog.createdAt.toISOString(),
      user: activityLog.user,
    }
  })

/**
 * Application Layer for Activity Log Details
 */
export const GetActivityLogDetailsLayer = ActivityLogServiceLive
