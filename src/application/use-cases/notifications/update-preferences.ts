/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { NotificationPreferenceRepository } from '@/application/ports/repositories/notification-preference-repository'
import type { NotificationPreferenceDatabaseError } from '@/application/ports/repositories/notification-preference-repository'


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
