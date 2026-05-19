/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect, Layer } from 'effect'
import { RealtimeService, RealtimeError } from '@/application/ports/services/realtime-service'
import { logInfo } from '@/infrastructure/logging/logger'
import { addSubscription, removeSubscription, getSubscribers } from './channel-manager'

export const RealtimeServiceLive = Layer.succeed(
  RealtimeService,
  RealtimeService.of({
    subscribe: (channel: string, callback: (event: Record<string, unknown>) => void) =>
      Effect.try({
        try: () => {
          void callback
          addSubscription(channel, 'default')
        },
        catch: (error: unknown) => new RealtimeError({ cause: error }),
      }),

    unsubscribe: (channel: string) =>
      Effect.try({
        try: () => {
          removeSubscription(channel, 'default')
        },
        catch: (error: unknown) => new RealtimeError({ cause: error }),
      }),

    broadcast: (channel: string, event: string, data: Record<string, unknown>) =>
      Effect.try({
        try: () => {
          const subscribers = getSubscribers(channel)
          logInfo(
            `[realtime] broadcast channel=${channel} event=${event} subscribers=${String(subscribers.length)} data=${JSON.stringify(data).slice(0, 100)}`
          )
        },
        catch: (error: unknown) => new RealtimeError({ cause: error }),
      }),

    getPresence: (channel: string) =>
      Effect.try({
        try: () => {
          const subscribers = getSubscribers(channel)
          return subscribers.map(
            (id) => ({ userId: id, channel }) as Record<string, unknown>
          ) as readonly Record<string, unknown>[]
        },
        catch: (error: unknown) => new RealtimeError({ cause: error }),
      }),
  })
)
