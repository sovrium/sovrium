/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { NotificationSubscriptionRepository } from '@/application/ports/repositories/notification-subscription-repository'
import type { NotificationSubscriptionDatabaseError } from '@/application/ports/repositories/notification-subscription-repository'


export interface DeleteNotificationSubscriptionInput {
  readonly userId: string
  readonly subscriptionId: string
}

export const deleteNotificationSubscription = (
  input: DeleteNotificationSubscriptionInput
): Effect.Effect<
  boolean,
  NotificationSubscriptionDatabaseError,
  NotificationSubscriptionRepository
> =>
  Effect.gen(function* () {
    const repo = yield* NotificationSubscriptionRepository
    return yield* repo.deleteForUser({ id: input.subscriptionId, userId: input.userId })
  })
