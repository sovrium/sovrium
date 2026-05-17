/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { NotificationRepository } from '@/application/ports/repositories/notification-repository'
import type { NotificationDatabaseError } from '@/application/ports/repositories/notification-repository'

/**
 * Mark a single notification as read, scoped to the requesting user.
 *
 * Authorization model: re-read the user's full inbox and verify the
 * notification id is in it before issuing the markRead. Cheap at typical
 * inbox sizes; prevents cross-user mutation. A dedicated `findById` on
 * the repo would shave a round-trip — deferred until a hot path needs it.
 *
 * Returns `{ ok: false }` when the id doesn't belong to the user (or
 * doesn't exist) so the route handler can map to 404 without leaking
 * which case actually fired.
 */

export interface MarkNotificationReadInput {
  readonly userId: string
  readonly notificationId: string
}

export type MarkNotificationReadResult = { readonly ok: boolean }

export const markNotificationRead = (
  input: MarkNotificationReadInput
): Effect.Effect<MarkNotificationReadResult, NotificationDatabaseError, NotificationRepository> =>
  Effect.gen(function* () {
    const repo = yield* NotificationRepository
    const all = yield* repo.findByUser(input.userId)
    const owned = all.some((row) => row['id'] === input.notificationId)
    if (!owned) return { ok: false }
    yield* repo.markRead(input.notificationId)
    return { ok: true }
  })
