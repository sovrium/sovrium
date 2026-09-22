/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Real-time presence-awareness endpoint — Wave-6.
 *
 * Served at `GET /api/realtime/presence?pagePath=/tasks`.
 *
 * Drives `[internal ref]`
 *.
 *
 * When a user opens a page configured with `presence: true`, the
 * presence-indicator island opens an SSE connection here. The handler:
 *
 *  1. Resolves the user's display name + avatar from the Better Auth `user`
 * table.
 *  2. Registers a presence entry on the page-path channel and broadcasts a
 * `join` event to other connections.
 *  3. Streams an immediate `presence-sync` snapshot so the joining user sees
 * every colleague already on the page.
 *  4. Streams live `join` / `leave` events from the presence channel.
 *  5. On disconnect (clean close, lifetime timeout, OR client navigation),
 * deregisters the entry and broadcasts a `leave` event.
 * The 60s stale-cleanup timer reaps entries whose
 *     connection dropped without a clean close.
 *
 * Presence is scoped strictly per `pagePath`: the channel
 * key is derived solely from the page path, so a `/tasks` subscriber never
 * receives `/projects` presence events.
 *
 * The SSE lifecycle (preamble → drain → heartbeat → lifetime ceiling) is
 * delegated to the shared `runEffectSse` bridge; this file only owns the
 * presence-specific side effects (`joinPresence` / `touchPresence` /
 * `leavePresence`) and the channel-listener source.
 *
 * Auth: the route is mounted with `authMiddleware` (no `requireAuth` chained)
 * so the handler can return a JSON 401 itself rather than the generic
 * middleware envelope.
 */

import { Effect, Queue, Stream } from 'effect'
import { addChannelListener } from '@/infrastructure/realtime/channel-manager'
import {
  joinPresence,
  leavePresence,
  presenceChannel,
  startPresenceReaper,
  touchPresence,
} from '@/infrastructure/realtime/presence-manager'
import { resolvePresenceUser } from '@/infrastructure/realtime/presence-queries'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import { runEffectSse } from '@/presentation/api/runtime/effect-sse'
import type { RealtimePresenceEntry } from '@/domain/models/api/realtime/realtime'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * Handle `GET /api/realtime/presence`.
 *
 * Requires an authenticated session (401 otherwise) and a `pagePath` query
 * param identifying the page-path presence channel to join. The channel is
 * namespaced by `app.name` to prevent cross-tenant leakage when more than
 * one app shares a process.
 */
export async function handlePresence(c: Context, app: App): Promise<Response> {
  const session = getSessionContext(c)
  if (!session) {
    return c.json({ success: false, message: 'Authentication required', code: 'UNAUTHORIZED' }, 401)
  }

  const pagePath = c.req.query('pagePath')
  if (pagePath === undefined || pagePath.trim() === '') {
    return c.json(
      { success: false, message: 'pagePath query parameter is required', code: 'BAD_REQUEST' },
      400
    )
  }

  // Arm the stale-cleanup timer on the first presence connection.
  startPresenceReaper()

  const userMeta = await resolvePresenceUser(session.userId)
  const entry: RealtimePresenceEntry = {
    id: session.userId,
    name: userMeta.name,
    pagePath,
    joinedAt: new Date().toISOString(),
    ...(userMeta.avatarUrl !== undefined ? { avatarUrl: userMeta.avatarUrl } : {}),
  }

  // Each connection (browser tab) gets a distinct presence entry so closing
  // one tab does not evict another tab of the same user.
  const connectionId = crypto.randomUUID()

  // Register the entry + broadcast `join` to other connections, then surface
  // the resulting snapshot in the preamble so the joining user sees every
  // colleague already on the page. `leavePresence` is fired by the bridge's
  // `onTerminate` callback for ALL termination reasons (clean close, lifetime
  // timeout, client navigation/abort). The channel is namespaced by `app.name`
  // (per main's tenant-namespacing refactor) so two apps holding presence on
  // the same page path never observe each other's join/leave traffic.
  const appId = app.name
  const snapshot = joinPresence({ appId, connectionId, pagePath, entry })

  // Stream.callback lifts the channel-manager's listener-callback shape into an
  // Effect.Stream. The registered finalizer unsubscribes the listener when the
  // stream is interrupted (which the bridge does on lifetime / abort / drain
  // failure via `Effect.race`'s interruption).
  // EFFECT 4: `Stream.async(emit => cleanupEffect)` is replaced by
  // `Stream.callback(queue => effect)` (migration/v3-to-v4.md:14924). Two
  // things change, not one:
  //   - the push handle is a Queue, so `emit.single(x)` becomes
  //     `Queue.offerUnsafe(queue, x)` — still synchronous, which the
  //     listener callback requires;
  //   - the RETURNED effect is no longer the cleanup. v3 treated it as the
  //     finalizer; v4 just runs it, so the unsubscribe has to be registered
  //     with `Effect.addFinalizer` against the stream's Scope or it silently
  //     never runs and the listener leaks on every disconnect.
  const source = Stream.callback<Record<string, unknown>>((queue) =>
    Effect.gen(function* () {
      const unsubscribe = addChannelListener(presenceChannel(appId, pagePath), (event) => {
        // eslint-disable-next-line functional/no-expression-statements -- synchronous push into the stream queue
        Queue.offerUnsafe(queue, event)
      })

      yield* Effect.addFinalizer(() => Effect.sync(() => unsubscribe()))
    })
  )

  return runEffectSse(c, source, (event) => ({ kind: 'data', payload: event }), {
    preamble: [{ type: 'presence-sync', pagePath, users: snapshot }],
    onHeartbeat: () => touchPresence({ appId, connectionId, pagePath }),
    onTerminate: () => leavePresence({ appId, connectionId, pagePath }),
  })
}
