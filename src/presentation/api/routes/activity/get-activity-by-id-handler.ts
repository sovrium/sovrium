/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { GetActivityById } from '@/application/use-cases/activity/programs'
import { DatabaseLive } from '@/infrastructure/database'
import type { Context } from 'hono'

/**
 * GET /api/activity/:activityId handler
 *
 * Fetches activity log details by ID with user metadata.
 *
 * **Authentication**: Requires authenticated session
 * **Authorization**: All authenticated users can view activity logs
 *
 * **Response Structure**:
 * - 200: Activity details with user metadata
 * - 400: Invalid activity ID format
 * - 401: Unauthorized (no session)
 * - 404: Activity not found
 *
 * @param c - Hono context
 * @returns JSON response with activity details or error
 */
export async function getActivityByIdHandler(c: Context) {
  const activityId = c.req.param('activityId')

  const program = GetActivityById(activityId).pipe(Effect.provide(DatabaseLive))

  const result = await Effect.runPromise(program.pipe(Effect.either))

  if (result._tag === 'Left') {
    const error = result.left

    // Handle specific error types
    if (error._tag === 'InvalidActivityIdError') {
      return c.json(
        {
          success: false,
          message: 'Invalid activity ID format',
          code: 'INVALID_ACTIVITY_ID',
        },
        400
      )
    }

    if (error._tag === 'ActivityNotFoundError') {
      return c.json(
        {
          success: false,
          message: 'Activity not found',
          code: 'ACTIVITY_NOT_FOUND',
        },
        404
      )
    }

    // Database error
    return c.json(
      {
        success: false,
        message: 'Failed to fetch activity',
        code: 'DATABASE_ERROR',
      },
      500
    )
  }

  const activity = result.right

  return c.json(activity, 200)
}
