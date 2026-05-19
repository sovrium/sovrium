/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import { NotificationRepository } from '@/application/ports/repositories/notification-repository'
import {
  NotificationService,
  NotificationServiceError,
} from '@/application/ports/services/notification-service'
import { RealtimeService } from '@/application/ports/services/realtime-service'
import { logInfo } from '@/infrastructure/logging/logger'


interface NotificationInput {
  readonly type: string
  readonly title: string
  readonly message: string
  readonly data?: Record<string, unknown>
}

const dispatchProgram = (
  userId: string,
  notification: NotificationInput
): Effect.Effect<void, never, NotificationRepository | RealtimeService> =>
  Effect.gen(function* () {
    const repo = yield* NotificationRepository
    const realtime = yield* RealtimeService
    const row = yield* repo.create({
      userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      ...(notification.data !== undefined ? { data: notification.data } : {}),
    })
    yield* realtime.broadcast(`notifications:user:${userId}`, 'notification.created', {
      id: row['id'],
      userId,
      type: notification.type,
      title: notification.title,
      body: notification.message,
      createdAt: row['createdAt'],
    })
  }).pipe(
    Effect.catchAllCause((cause) =>
      Effect.sync(() => {
        console.error(`[notification] dispatch failed user=${userId}`, cause)
      })
    )
  )

export const NotificationServiceLive = Layer.effect(
  NotificationService,
  Effect.gen(function* () {
    const runtime = yield* Effect.runtime<NotificationRepository | RealtimeService>()

    return NotificationService.of({
      send: (userId, notification) =>
        Effect.tryPromise({
          try: () =>
            Effect.runPromise(dispatchProgram(userId, notification).pipe(Effect.provide(runtime))),
          catch: (error: unknown) => new NotificationServiceError({ cause: error }),
        }),

      sendBulk: (userIds, notification) =>
        Effect.tryPromise({
          try: () =>
            Effect.runPromise(
              Effect.forEach(userIds, (userId) => dispatchProgram(userId, notification), {
                concurrency: 1,
                discard: true,
              }).pipe(Effect.provide(runtime))
            ),
          catch: (error: unknown) => new NotificationServiceError({ cause: error }),
        }),

      scheduleDigest: (userId, interval) =>
        Effect.try({
          try: () => {
            logInfo(`[notification] scheduleDigest user=${userId} interval=${interval}`)
          },
          catch: (error: unknown) => new NotificationServiceError({ cause: error }),
        }),
    })
  })
)
