/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { NotificationPreferenceRepository } from '@/application/ports/repositories/notification-preference-repository'
import type { NotificationPreferenceDatabaseError } from '@/application/ports/repositories/notification-preference-repository'

/**
 * Bulk-update a user's notification preferences from a partial-channel
 * payload. For each `(eventType, partialChannels)` pair:
 *   1. Read the existing row (if any) to get the current channel set
 *   2. Merge `partialChannels` over the current set
 *   3. Upsert the merged result
 *
 * Sequential per-row reads are fine at typical preference-set sizes
 * (single-digit event types per app); a future optimization can batch.
 *
 * Skips empty event-type keys and non-object values without raising,
 * mirroring the route's defensive parsing of unsanitized JSON input.
 */

export interface UpdateNotificationPreferencesInput {
  readonly userId: string
  readonly body: Readonly<Record<string, Readonly<Record<string, boolean>>>>
}

export const updateNotificationPreferences = (
  input: UpdateNotificationPreferencesInput
): Effect.Effect<void, NotificationPreferenceDatabaseError, NotificationPreferenceRepository> =>
  Effect.gen(function* () {
    const repo = yield* NotificationPreferenceRepository
    yield* Effect.forEach(
      Object.entries(input.body),
      ([eventType, partialChannels]) =>
        Effect.gen(function* () {
          if (eventType === '' || typeof partialChannels !== 'object' || partialChannels === null) {
            return
          }
          const existing = yield* repo.findByUserAndEvent({ userId: input.userId, eventType })
          const current = (existing?.['channels'] as Record<string, boolean> | undefined) ?? {}
          const merged = { ...current, ...partialChannels }
          yield* repo.upsert({ userId: input.userId, eventType, channels: merged })
        }),
      { discard: true }
    )
  })
