/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The social half of the GDPR export: what the app keeps about how the caller
 * reads and is reached — her read positions, when she was last seen, the
 * notifications she received and the notification channels she chose. Each
 * section is hers alone, read by her own id, and erased with her account.
 */

import { Effect } from 'effect'
import { lastSeenOfProgram } from '@/application/use-cases/auth/user-presence-programs'
import {
  exportMyNotificationsProgram,
  toNotificationView,
} from '@/application/use-cases/automations/notification-programs'
import { listReadPositionsProgram } from '@/application/use-cases/tables/read-state-programs'
import type {
  UserPresenceDatabaseError,
  UserPresenceRepository,
} from '@/application/ports/repositories/auth/user-presence-repository'
import type {
  NotificationDatabaseError,
  NotificationRepository,
} from '@/application/ports/repositories/automations/notification-repository'
import type {
  ReadStateDatabaseError,
  ReadStateRepository,
} from '@/application/ports/repositories/tables/read-state-repository'

/** What reading the social sections can fail with. */
export type SocialErrors =
  ReadStateDatabaseError | UserPresenceDatabaseError | NotificationDatabaseError

/** The stores the social sections are read from. */
export type SocialServices = ReadStateRepository | UserPresenceRepository | NotificationRepository

/** The social sections, as the export payload carries them. */
export interface SocialExport {
  readonly readState: readonly {
    readonly table: string
    readonly recordId: string
    readonly lastReadAt: string
  }[]
  readonly presence: { readonly lastSeen: string | null }
  readonly notifications: readonly Omit<ReturnType<typeof toNotificationView>, 'id'>[]
  readonly notificationPreferences: readonly {
    readonly kind: string
    readonly channels: {
      readonly inApp: boolean
      readonly email: boolean
      readonly digest: boolean
    }
  }[]
}

/** Gather and shape the caller's social sections of the export. */
export const loadSocialExport = (
  userId: string
): Effect.Effect<SocialExport, SocialErrors, SocialServices> =>
  Effect.gen(function* () {
    const positions = yield* listReadPositionsProgram(userId)
    const lastSeen = yield* lastSeenOfProgram([userId])
    const received = yield* exportMyNotificationsProgram(userId)
    return {
      readState: positions.map((position) => ({
        table: position.tableName,
        recordId: position.recordId,
        lastReadAt: position.lastReadAt.toISOString(),
      })),
      presence: { lastSeen: lastSeen.get(userId)?.toISOString() ?? null },
      notifications: received.notifications.map((stored) => {
        const { id: _id, ...view } = toNotificationView(stored)
        return view
      }),
      notificationPreferences: received.preferences.map(({ kind, inApp, email, digest }) => ({
        kind,
        channels: { inApp, email, digest },
      })),
    }
  }).pipe(Effect.withSpan('account.load-social-export'))
