/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable functional/no-expression-statements */

import { Effect, Layer } from 'effect'
import { RealtimeService, RealtimeError } from '@/application/ports/services/realtime-service'
import { logInfo } from '@/infrastructure/logging/logger'
import { addSubscription, removeSubscription, getSubscribers } from './channel-manager'

/**
 * In-memory realtime service implementation.
 *
 * Uses Hono's built-in SSE/WebSocket support. This is the foundation
 * layer — actual SSE/WS connections are managed at the presentation layer
 * (Hono routes). This service handles the publish/subscribe state.
 *
 * ⚠️ STATUS — STUB IMPLEMENTATION (audit L1)
 *
 * `broadcast()` is currently a `console.info` stub. It records subscriber
 * counts and a truncated payload to the server log, but does NOT push the
 * event over the wire to any client. There is no SSE endpoint, no
 * WebSocket upgrade, no client-side `EventSource` listener.
 *
 * Specs assert against the LOG output (the broadcast call is observable
 * via console capture), not against client receipt. Treat any test that
 * uses `RealtimeService.broadcast` as testing the producer side only —
 * the consumer side does not exist yet.
 *
 * Real wire delivery requires:
 *   1. A Hono route exposing `GET /api/realtime/subscribe?channel=:name`
 *      that upgrades to SSE (or WS), holds the connection open, and
 *      iterates events from the channel-manager queue.
 *   2. A client island that opens an `EventSource` against that route and
 *      dispatches events to subscribed components.
 *   3. Replacing the `console.info` body of `broadcast` with a real push
 *      into the per-channel queue that the SSE route reads.
 *
 * Until #1-#3 land, anything depending on real-time delivery (e.g. the
 * notifications inbox auto-refreshing on `notification.created`) needs a
 * polling fallback OR a manual refresh trigger to behave correctly in
 * production. The dispatcher and notification routes are otherwise
 * production-ready; only the wire transport is missing.
 */
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
          // Log-line truncation; not a validation surface.
          // @effect-diagnostics effect/preferSchemaOverJson:off
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
