/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { NotificationPreferenceRepository } from '@/application/ports/repositories/notification-preference-repository'
import type { NotificationPreferenceDatabaseError } from '@/application/ports/repositories/notification-preference-repository'
import type { App } from '@/domain/models/app'

/**
 * Resolve a user's effective notification preferences by merging template
 * defaults from the app config with their stored per-event overrides.
 *
 * Defaults: each template's `channels: ['inApp', 'email']` array is
 * expanded into per-channel booleans. The "known channels" set comes
 * from `app.notifications.channels[].type`, defaulting to `['inApp']`
 * when the config doesn't enumerate them.
 *
 * Overrides: rows in `system.notification_preferences` are merged on
 * top of the defaults, channel-by-channel, so a partial override only
 * flips the channels the user explicitly toggled.
 *
 * `emailDigestFrequency` is currently always null — surfaced for shape
 * stability so clients don't break when per-user digest scheduling lands.
 */

interface AppNotifications {
  readonly channels?: ReadonlyArray<{ readonly type: string }>
  readonly templates?: Readonly<Record<string, { readonly channels?: readonly string[] }>>
}

export interface GetNotificationPreferencesInput {
  readonly userId: string
  readonly app: App
}

export interface NotificationPreferencesResult {
  readonly preferences: Readonly<Record<string, Readonly<Record<string, boolean>>>>
  readonly emailDigestFrequency: null
}

const knownChannelsFromApp = (notifications: AppNotifications | undefined): readonly string[] => {
  const fromConfig = notifications?.channels?.map((c) => c.type) ?? []
  // Default to inApp if no channels configured — the schema's `notifications`
  // field is optional, and a server with templates but no channels list
  // (rare) should still surface the implicit inApp channel.
  return fromConfig.length > 0 ? fromConfig : ['inApp']
}

const defaultsFromTemplateChannels = (
  channels: readonly string[],
  knownChannels: readonly string[]
): Record<string, boolean> => {
  return Object.fromEntries(knownChannels.map((c) => [c, channels.includes(c)]))
}

export const getNotificationPreferences = (
  input: GetNotificationPreferencesInput
): Effect.Effect<
  NotificationPreferencesResult,
  NotificationPreferenceDatabaseError,
  NotificationPreferenceRepository
> =>
  Effect.gen(function* () {
    const { notifications } = input.app as { notifications?: AppNotifications }
    const knownChannels = knownChannelsFromApp(notifications)
    const templates = notifications?.templates ?? {}

    const repo = yield* NotificationPreferenceRepository
    const rows = yield* repo.findByUser(input.userId)

    const userOverrides = rows.reduce<Record<string, Record<string, boolean>>>((acc, row) => {
      const eventType = String(row['eventType'] ?? '')
      return eventType === ''
        ? acc
        : { ...acc, [eventType]: (row['channels'] as Record<string, boolean>) ?? {} }
    }, {})

    const preferences = Object.fromEntries(
      Object.entries(templates).map(([name, template]) => [
        name,
        {
          ...defaultsFromTemplateChannels(template?.channels ?? [], knownChannels),
          ...(userOverrides[name] ?? {}),
        },
      ])
    )

    /* eslint-disable unicorn/no-null -- contract field; null when no per-user digest schedule */
    return {
      preferences,
      emailDigestFrequency: null,
    }
    /* eslint-enable unicorn/no-null */
  })
