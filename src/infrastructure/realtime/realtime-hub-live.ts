/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Live `RealtimeHub`: one server's realtime transport state — channel
 * listeners, presence entries, the connection registry, the people online —
 * built with the server runtime and gone with it, together with the two sweeps
 * that state needs:
 *
 *  - the PRESENCE REAPER, which drops the entries of connections that stopped
 *    sending heartbeats without a clean close, every `presenceStaleTimeoutMs`;
 *  - the GRANT RE-CHECK, which judges every long-lived connection's session
 *    and grant again, every `grantRecheckIntervalMs`.
 *
 * Both sweeps are fibers forked into the layer's scope, so closing the scope
 * (the server's stop, which disposes its runtime) interrupts them. Neither a
 * sweep nor the state it sweeps outlives its server: a second server booted in
 * the same process, or after a `sovrium dev` restart, begins with no
 * subscriptions, no presence and no connection counted against any cap.
 *
 * The state is built here and INSTALLED (`./current-realtime-hub`) for the
 * callers that hold no Effect context; see that module for why there is still
 * a pointer, and for which hub is current when several are built at once.
 * The service yields the same hub, for a caller that does hold a context.
 */

import { Context, Data, Duration, Effect, Layer, Schedule } from 'effect'
import { REALTIME_TRANSPORT_CONFIG } from '@/domain/models/api/realtime/realtime'
import { Database } from '@/infrastructure/database/drizzle/layer'
import { logError } from '@/infrastructure/logging/logger'
import { makeAppConnectionCounts } from './app-connections'
import { makeChannelRegistry } from './channel-manager'
import { makeConnectionRegistry, type LiveSessionReader } from './connection-counter'
import { installRealtimeHub, type RealtimeHubState } from './current-realtime-hub'
import { makePresenceRegistry } from './presence-manager'
import { readLiveSessionIdsIn } from './session-liveness-queries'

/** The running server's realtime transport state. One per server runtime. */
export class RealtimeHub extends Context.Service<RealtimeHub, RealtimeHubState>()('RealtimeHub') {}

/** A grant re-check sweep that rejected: a fault of the sweep itself, not of one connection. */
class RealtimeRecheckError extends Data.TaggedError('RealtimeRecheckError')<{
  readonly cause: unknown
}> {}

/** How often the sweeps run, and what they read: the seam a unit test shortens. */
export interface RealtimeHubTiming {
  /** Interval between two presence reaps. */
  readonly reapEveryMs: number
  /** How long an entry may go without a heartbeat before it is reaped. */
  readonly presenceStaleAfterMs: number
  /** Interval between two grant re-checks. */
  readonly recheckEveryMs: number
  /** Which sessions are still alive. */
  readonly readLiveSessions: LiveSessionReader
}

/** The transport's configured timing, reading liveness through `readLiveSessions`. */
const productionTiming = (readLiveSessions: LiveSessionReader): RealtimeHubTiming => ({
  reapEveryMs: REALTIME_TRANSPORT_CONFIG.presenceStaleTimeoutMs,
  presenceStaleAfterMs: REALTIME_TRANSPORT_CONFIG.presenceStaleTimeoutMs,
  recheckEveryMs: REALTIME_TRANSPORT_CONFIG.grantRecheckIntervalMs,
  readLiveSessions,
})

/** A fresh hub: every registry empty, wired to one channel fan-out. */
export const makeRealtimeHubState = (): RealtimeHubState => {
  const channels = makeChannelRegistry()
  return {
    channels,
    presence: makePresenceRegistry(channels, REALTIME_TRANSPORT_CONFIG.maxPresenceEntriesPerPage),
    connections: makeConnectionRegistry(),
    people: makeAppConnectionCounts(),
  }
}

/** Run `sweep` every `everyMs`, after a first wait of the same length, until interrupted. */
const every = (everyMs: number, sweep: Effect.Effect<unknown>): Effect.Effect<void> =>
  Effect.sleep(Duration.millis(everyMs)).pipe(
    Effect.andThen(sweep),
    Effect.repeat(Schedule.spaced(Duration.millis(everyMs))),
    Effect.asVoid
  )

/** One reap of the stale presence entries. Synchronous and total. */
const reapOnce = (hub: RealtimeHubState, timing: RealtimeHubTiming): Effect.Effect<void> =>
  Effect.sync(() => {
    hub.presence.reapStale(Date.now(), timing.presenceStaleAfterMs)
  })

/**
 * One grant re-check sweep. A sweep that rejects is logged and absorbed: the
 * connections stay as they are, and the next sweep judges them again.
 */
const recheckOnce = (hub: RealtimeHubState, timing: RealtimeHubTiming): Effect.Effect<void> =>
  Effect.tryPromise({
    try: () => hub.connections.recheck(timing.readLiveSessions),
    catch: (cause) => new RealtimeRecheckError({ cause }),
  }).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() => logError('[realtime] a grant re-check sweep failed', cause))
    ),
    // effect-swallow: logged above; a failed sweep closes nothing, and the next one runs on schedule.
    Effect.ignoreCause
  )

/**
 * The hub layer with explicit sweep timing. {@link RealtimeHubLive} is this
 * with the transport's configured intervals.
 */
export const makeRealtimeHubLayer = (timing: RealtimeHubTiming) =>
  Layer.effect(
    RealtimeHub,
    Effect.gen(function* () {
      const hub = yield* Effect.acquireRelease(
        Effect.sync(() => {
          const state = makeRealtimeHubState()
          return { state, uninstall: installRealtimeHub(state) }
        }),
        ({ state, uninstall }) =>
          Effect.sync(() => {
            uninstall()
            state.channels.clear()
            state.presence.clear()
            state.connections.clear()
            state.people.clear()
          })
      )
      // Forked into the layer's scope, AFTER the hub's own finalizer was added,
      // so a stop interrupts both sweeps before the hub is emptied.
      yield* Effect.forkScoped(every(timing.reapEveryMs, reapOnce(hub.state, timing)))
      yield* Effect.forkScoped(every(timing.recheckEveryMs, recheckOnce(hub.state, timing)))
      return hub.state
    }).pipe(Effect.withSpan('realtime.hub.make'))
  )

/**
 * The live hub, one per server runtime (`server/domain-runtime.ts`): its
 * grant re-check reads session liveness through the runtime's `Database`.
 */
export const RealtimeHubLive = Layer.unwrap(
  Effect.map(Database, ({ client }) =>
    makeRealtimeHubLayer(productionTiming(readLiveSessionIdsIn(client)))
  )
)
