/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  getActivityById as getActivityByIdQuery,
  type ActivityLogDetail,
  type ActivityNotFoundError,
  type DatabaseError,
} from '@/infrastructure/database/table-queries/get-activity-by-id'
import type { Effect } from 'effect'

/**
 * Get Activity By ID Use Case
 *
 * Retrieves a single activity log entry by its ID with user metadata.
 *
 * @param activityId - The ID of the activity log to retrieve
 * @returns Effect that resolves to activity log details
 */
export function GetActivityById(
  activityId: string
): Effect.Effect<ActivityLogDetail, ActivityNotFoundError | DatabaseError, never> {
  return getActivityByIdQuery(activityId)
}
