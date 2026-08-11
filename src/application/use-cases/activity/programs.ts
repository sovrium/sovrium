/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  getActivityById,
  type ActivityDatabaseError,
  type ActivityNotFoundError,
} from '@/infrastructure/database/table-queries/activity-queries'

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
const ACTIVITY_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const GetActivityById = (activityId: string) =>
  Effect.gen(function* () {
    // Activity IDs are UUIDs. Anything else is a malformed request, not a
    // lookup miss, so it fails here rather than reaching the database.
    if (!ACTIVITY_ID_PATTERN.test(activityId)) {
      return yield* Effect.fail(new InvalidActivityIdError(activityId))
    }

    const activity = yield* getActivityById(activityId)

    return activity
  })

/**
 * Export all error types for external use
 * @public
 */
export type GetActivityByIdError =
  InvalidActivityIdError | ActivityNotFoundError | ActivityDatabaseError
