/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data, type Effect } from 'effect'

/** Database error for notification-store operations. */
export class NotificationDatabaseError extends Data.TaggedError('NotificationDatabaseError')<{
  readonly cause: unknown
}> {}

/** One stored notification, as its recipient reads it. */
export interface StoredNotification {
  readonly id: string
  readonly kind: string
  readonly title: string
  readonly body: string | null
  readonly sourceTable: string | null
  readonly sourceRecordId: string | null
  readonly createdAt: Date
  readonly readAt: Date | null
}

/** A notification to write for one recipient. */
export interface NewNotification {
  readonly recipientId: string
  readonly kind: string
  readonly title: string
  readonly body: string | null
  readonly sourceTable: string | null
  readonly sourceRecordId: string | null
  /** Whether she lists it in her notifications. */
  readonly inApp: boolean
  /** Whether it waits for a digest to collect. */
  readonly digest: boolean
}

/** The channels one person chose for one kind. */
export interface ChosenChannels {
  readonly userId: string
  readonly kind: string
  readonly inApp: boolean
  readonly email: boolean
  readonly digest: boolean
}

/**
 * `system.notifications` and `system.notification_preferences` port — the
 * engine's notification store, read and written for one recipient at a time.
 * Every read and every mark names its recipient: a notification of someone
 * else is never read, listed, counted or marked.
 */
export class NotificationRepository extends Context.Service<
  NotificationRepository,
  {
    /** Write notifications, in batches, so a broadcast never holds one statement too large. */
    readonly insertMany: (
      rows: readonly NewNotification[]
    ) => Effect.Effect<void, NotificationDatabaseError>

    /** Her listed (in-app) notifications, newest first, at most `limit`. */
    readonly listFor: (
      userId: string,
      limit: number
    ) => Effect.Effect<readonly StoredNotification[], NotificationDatabaseError>

    /** Every notification she still has, listed or waiting for a digest, newest first. */
    readonly everyFor: (
      userId: string
    ) => Effect.Effect<readonly StoredNotification[], NotificationDatabaseError>

    /** How many of her listed notifications are unread. */
    readonly unreadCountFor: (userId: string) => Effect.Effect<number, NotificationDatabaseError>

    /**
     * Mark one of her listed notifications read (a read one keeps its first
     * read time). Answers it, or nothing when she has no such notification.
     */
    readonly markRead: (input: {
      readonly userId: string
      readonly id: string
    }) => Effect.Effect<readonly StoredNotification[], NotificationDatabaseError>

    /** Mark every unread listed notification of hers read; answers how many. */
    readonly markAllRead: (userId: string) => Effect.Effect<number, NotificationDatabaseError>

    /** The channels these people chose, per kind they changed. */
    readonly preferencesOf: (
      userIds: readonly string[]
    ) => Effect.Effect<readonly ChosenChannels[], NotificationDatabaseError>

    /** Store the channels she chose, one row per kind. */
    readonly savePreferences: (
      chosen: readonly ChosenChannels[]
    ) => Effect.Effect<void, NotificationDatabaseError>
  }
>()('NotificationRepository') {}
