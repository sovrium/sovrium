/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

/**
 * Database error for notification-subscription operations.
 */
export class NotificationSubscriptionDatabaseError extends Data.TaggedError(
  'NotificationSubscriptionDatabaseError'
)<{
  readonly cause: unknown
}> {}

/**
 * Notification Subscription Repository Port.
 *
 * Backs `system.notification_subscriptions` — per-user subscriptions to
 * record-level events (create/update/delete on a specific table or
 * recordId). The auto-trigger logic in plan 03d uses
 * `findByTableAndRecord` to find which users to notify when a record
 * changes.
 *
 * `recordId` is nullable: a subscription with `recordId IS NULL` means
 * "all records in this table"; a non-null recordId scopes to one row.
 * `fields` is nullable jsonb: when set, the trigger only fires when one
 * of the listed fields changed (out of scope for 03c, design hook only).
 */
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
    /**
     * Delete a subscription scoped to one user. Returns `true` when a
     * row was actually deleted (i.e. the id existed AND belonged to the
     * user); `false` for not-found or cross-user attempts.
     */
    readonly deleteForUser: (input: {
      readonly id: string
      readonly userId: string
    }) => Effect.Effect<boolean, NotificationSubscriptionDatabaseError>
  }
>() {}
