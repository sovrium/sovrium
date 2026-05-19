/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

export class NotificationSubscriptionDatabaseError extends Data.TaggedError(
  'NotificationSubscriptionDatabaseError'
)<{
  readonly cause: unknown
}> {}

export class NotificationSubscriptionRepository extends Context.Tag(
  'NotificationSubscriptionRepository'
)<
  NotificationSubscriptionRepository,
  {
    readonly create: (input: {
      readonly userId: string
      readonly tableName: string
      readonly recordId?: string
      readonly fields?: readonly string[]
    }) => Effect.Effect<Record<string, unknown>, NotificationSubscriptionDatabaseError>
    readonly findByUser: (
      userId: string
    ) => Effect.Effect<readonly Record<string, unknown>[], NotificationSubscriptionDatabaseError>
    readonly findByTableAndRecord: (input: {
      readonly tableName: string
      readonly recordId?: string
    }) => Effect.Effect<readonly Record<string, unknown>[], NotificationSubscriptionDatabaseError>
    readonly deleteForUser: (input: {
      readonly id: string
      readonly userId: string
    }) => Effect.Effect<boolean, NotificationSubscriptionDatabaseError>
  }
>() {}
