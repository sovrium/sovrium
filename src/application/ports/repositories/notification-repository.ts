/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

export class NotificationDatabaseError extends Data.TaggedError('NotificationDatabaseError')<{
  readonly cause: unknown
}> {}

export class NotificationRepository extends Context.Tag('NotificationRepository')<
  NotificationRepository,
  {
    readonly findByUser: (
      userId: string
    ) => Effect.Effect<readonly Record<string, unknown>[], NotificationDatabaseError>
    readonly create: (notification: {
      readonly userId: string
      readonly type: string
      readonly title: string
      readonly message: string
      readonly data?: Record<string, unknown>
    }) => Effect.Effect<Record<string, unknown>, NotificationDatabaseError>
    readonly markRead: (id: string) => Effect.Effect<void, NotificationDatabaseError>
    readonly markAllRead: (userId: string) => Effect.Effect<void, NotificationDatabaseError>
    readonly markDismissed: (id: string) => Effect.Effect<void, NotificationDatabaseError>
    readonly delete: (id: string) => Effect.Effect<void, NotificationDatabaseError>
  }
>() {}
