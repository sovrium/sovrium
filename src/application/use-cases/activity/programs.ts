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

export class InvalidActivityIdError {
  readonly _tag = 'InvalidActivityIdError'
  constructor(readonly activityId: string) {}
}

export const GetActivityById = (activityId: string) =>
  Effect.gen(function* () {
    if (!activityId || activityId.trim() === '') {
      return yield* Effect.fail(new InvalidActivityIdError(activityId))
    }

    const parsedId = parseInt(activityId, 10)
    const isNumericId = !isNaN(parsedId) && parsedId > 0 && parsedId.toString() === activityId

    const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      activityId
    )

    if (!isNumericId && !isValidUuid) {
      return yield* Effect.fail(new InvalidActivityIdError(activityId))
    }

    const activity = yield* getActivityById(activityId)

    return activity
  })

export type GetActivityByIdError =
  | InvalidActivityIdError
  | ActivityNotFoundError
  | ActivityDatabaseError
