/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

/**
 * Database error for notification-preference operations.
 */
export class NotificationPreferenceDatabaseError extends Data.TaggedError(
  'NotificationPreferenceDatabaseError'
)<{
  readonly cause: unknown
}> {}

/**
 * Channel toggles per (userId, eventType). Stored as JSONB so the shape
 * stays open as new channels (push, sms, etc.) come online.
 */
export type ChannelToggles = Readonly<Record<string, boolean>>

/**
 * Notification Preference Repository Port.
 *
 * Backs `system.notification_preferences` — per-user-per-event-type
 * channel toggles. The dispatcher uses these to decide whether to
 * actually deliver a notification to a given channel; the GET API
 * endpoint merges these with defaults derived from
 * `app.notifications.templates[name].channels`.
 *
 * `upsert` is keyed on `(userId, eventType)` — not enforced by a unique
 * index in the schema today (the existing index is non-unique), so the
 * impl reads-then-writes to keep the (userId, eventType) row-count at
 * one per pair. Adding a unique index in a follow-up migration would
 * let this collapse to ON CONFLICT DO UPDATE.
 */
export class NotificationPreferenceRepository extends Context.Tag(
  'NotificationPreferenceRepository'
)<
  NotificationPreferenceRepository,
  {
    readonly findByUser: (
      userId: string
    ) => Effect.Effect<readonly Record<string, unknown>[], NotificationPreferenceDatabaseError>
    readonly findByUserAndEvent: (input: {
      readonly userId: string
      readonly eventType: string
    }) => Effect.Effect<Record<string, unknown> | undefined, NotificationPreferenceDatabaseError>
    readonly upsert: (input: {
      readonly userId: string
      readonly eventType: string
      readonly channels: ChannelToggles
      readonly enabled?: boolean
    }) => Effect.Effect<Record<string, unknown>, NotificationPreferenceDatabaseError>
  }
>() {}
