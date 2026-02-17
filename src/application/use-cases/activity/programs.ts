/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  getActivityById,
  ActivityDatabaseError,
  ActivityNotFoundError,
} from '@/infrastructure/database/activity-queries'

/**
 * Invalid activity ID error
 */
export class InvalidActivityIdError {
  readonly _tag = 'InvalidActivityIdError'
  constructor(readonly activityId: string) {}
}

/**
 * Get activity log by ID
 *
 * Validates the activity ID format and fetches activity details with user metadata.
 *
 * @param activityId - Activity ID as string (UUID from URL parameter)
 * @returns Effect program that resolves to activity with user or fails with error
 */
export const GetActivityById = (activityId: string) =>
  Effect.gen(function* () {
    // Validate activity ID format (must be non-empty string)
    // In production, activity IDs are UUIDs, but for simplicity we accept any non-empty string
    // Integer validation for backward compatibility with tests expecting numeric IDs
    if (!activityId || activityId.trim() === '') {
      return yield* Effect.fail(new InvalidActivityIdError(activityId))
    }

    // Try to parse as integer for backward compatibility
    const parsedId = parseInt(activityId, 10)
    const isNumericId = !isNaN(parsedId) && parsedId > 0 && parsedId.toString() === activityId

    // Reject obviously invalid formats like "invalid-id"
    // Accept UUIDs and numeric strings
    const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      activityId
    )

    if (!isNumericId && !isValidUuid) {
      return yield* Effect.fail(new InvalidActivityIdError(activityId))
    }

    // Fetch activity from database (accepts both numeric and UUID strings)
    const activity = yield* getActivityById(activityId)

    return activity
  })

/**
 * Export all error types for external use
 */
export type GetActivityByIdError =
  | InvalidActivityIdError
  | ActivityNotFoundError
  | ActivityDatabaseError
