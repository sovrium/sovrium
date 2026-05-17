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

/**
 * Multi-channel notification dispatch implementation.
 *
 * Writes the in-app row to `system.notifications` via the repository AND
 * emits a realtime broadcast on `notifications:user:<userId>` so any
 * subscribed client receives the new notification immediately. The
 * realtime transport (SSE/WebSocket) is currently a `console.info` stub
 * at the `RealtimeServiceLive.broadcast` boundary — over-the-wire
 * delivery is out of scope here; the broadcast call itself is the
 * observable side-effect that specs assert against.
 *
 * Email delivery is not yet wired here (a separate channel concern).
 *
 * Errors from the repo or realtime collapse into a logged failure
 * rather than rejecting the calling Effect — a notification failure
 * should not break the upstream business operation that triggered it.
 *
 * Audit M5/M6: this Layer takes its dependencies (`NotificationRepository`,
 * `RealtimeService`) via Effect Context, instead of the previous
 * `dispatcher.ts` pattern of self-providing them inside a hidden
 * `Layer.mergeAll` runtime. Tests can swap repo or realtime layers
 * freely; production composition happens at `NotificationsLive`.
 */

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
    // Capture the runtime so the .send / .sendBulk closures can resolve
    // their dependencies on each call without re-yielding from Context.
    const runtime = yield* Effect.runtime<NotificationRepository | RealtimeService>()

    return NotificationService.of({
      send: (userId, notification) =>
        Effect.tryPromise({
          try: () =>
            // @effect-diagnostics effect/runEffectInsideEffect:off
            Effect.runPromise(dispatchProgram(userId, notification).pipe(Effect.provide(runtime))),
          catch: (error: unknown) => new NotificationServiceError({ cause: error }),
        }),

      sendBulk: (userIds, notification) =>
        Effect.tryPromise({
          try: () =>
            // @effect-diagnostics effect/runEffectInsideEffect:off
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
            // Would schedule a digest notification via cron scheduler.
            logInfo(`[notification] scheduleDigest user=${userId} interval=${interval}`)
          },
          catch: (error: unknown) => new NotificationServiceError({ cause: error }),
        }),
    })
  })
)
