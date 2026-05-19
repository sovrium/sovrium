/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

export class NotificationServiceError extends Data.TaggedError('NotificationServiceError')<{
  readonly cause: unknown
}> {}

export class NotificationService extends Context.Tag('NotificationService')<
  NotificationService,
  {
    readonly send: (
      userId: string,
      notification: {
        readonly type: string
        readonly title: string
        readonly message: string
        readonly data?: Record<string, unknown>
      }
    ) => Effect.Effect<void, NotificationServiceError>
    readonly sendBulk: (
      userIds: readonly string[],
      notification: {
        readonly type: string
        readonly title: string
        readonly message: string
        readonly data?: Record<string, unknown>
      }
    ) => Effect.Effect<void, NotificationServiceError>
    readonly scheduleDigest: (
      userId: string,
      interval: string
    ) => Effect.Effect<void, NotificationServiceError>
  }
>() {}
