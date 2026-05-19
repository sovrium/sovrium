/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { NotificationRepository } from '@/application/ports/repositories/notification-repository'
import type { NotificationDatabaseError } from '@/application/ports/repositories/notification-repository'


export interface DismissNotificationInput {
  readonly userId: string
  readonly notificationId: string
}

export type DismissNotificationResult = { readonly ok: boolean }

export const dismissNotification = (
  input: DismissNotificationInput
): Effect.Effect<DismissNotificationResult, NotificationDatabaseError, NotificationRepository> =>
  Effect.gen(function* () {
    const repo = yield* NotificationRepository
    const all = yield* repo.findByUser(input.userId)
    const owned = all.some((row) => row['id'] === input.notificationId)
    if (!owned) return { ok: false }
    yield* repo.markDismissed(input.notificationId)
    return { ok: true }
  })
