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
 * Mark every unread notification for a user as read.
 *
 * The repo's `markAllRead` operates atomically on the user's rows; no
 * ownership check is required because the userId scopes the WHERE clause.
 */

export interface MarkAllNotificationsReadInput {
  readonly userId: string
}

export const markAllNotificationsRead = (
  input: MarkAllNotificationsReadInput
): Effect.Effect<void, NotificationDatabaseError, NotificationRepository> =>
  Effect.gen(function* () {
    const repo = yield* NotificationRepository
    yield* repo.markAllRead(input.userId)
  })
