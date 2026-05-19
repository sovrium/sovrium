/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { NotificationSubscriptionRepository } from '@/application/ports/repositories/notification-subscription-repository'
import type { NotificationSubscriptionDatabaseError } from '@/application/ports/repositories/notification-subscription-repository'


export interface CreateNotificationSubscriptionInput {
  readonly userId: string
  readonly tableName: string
  readonly recordId?: string
  readonly fields?: readonly string[]
}

export const createNotificationSubscription = (
  input: CreateNotificationSubscriptionInput
): Effect.Effect<
  Record<string, unknown>,
  NotificationSubscriptionDatabaseError,
  NotificationSubscriptionRepository
> =>
  Effect.gen(function* () {
    const repo = yield* NotificationSubscriptionRepository
    return yield* repo.create({
      userId: input.userId,
      tableName: input.tableName,
      ...(input.recordId !== undefined && input.recordId !== ''
        ? { recordId: input.recordId }
        : {}),
      ...(input.fields !== undefined ? { fields: input.fields } : {}),
    })
  })
