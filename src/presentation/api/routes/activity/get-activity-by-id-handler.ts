/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { GetActivityById } from '@/application/use-cases/activity/programs'
import { provideActivityLive } from './effect-runner'
import type { Context } from 'hono'

export async function getActivityByIdHandler(c: Context) {
  const activityId = c.req.param('activityId')!

  const program = GetActivityById(activityId).pipe(provideActivityLive)

  const result = await Effect.runPromise(program.pipe(Effect.either))

  if (result._tag === 'Left') {
    const error = result.left

    if (error._tag === 'InvalidActivityIdError') {
      return c.json(
        {
          success: false,
          message: 'Invalid activity ID format',
          code: 'BAD_REQUEST',
        },
        400
      )
    }

    if (error._tag === 'ActivityNotFoundError') {
      return c.json(
        {
          success: false,
          message: 'Activity not found',
          code: 'NOT_FOUND',
        },
        404
      )
    }

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
