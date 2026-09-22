/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable functional/no-expression-statements, functional/immutable-data */

/**
 * In-memory channel subscription manager.
 *
 * Manages which users are subscribed to which channels AND fans out live
 * change events to every open transport connection on a channel.
 *
 * This is an in-process implementation — for horizontal scaling, replace the
 * subscription map and the per-channel listener set with Redis pub/sub or a
 * dedicated message broker.
 */

// ---------------------------------------------------------------------------
// Subscription bookkeeping (which users are on which channel)
// ---------------------------------------------------------------------------

// The three exports in this section have exactly one consumer,
// `realtime-service-live.ts`, which is itself unreachable — see the realtime
// orphan cluster baselined in `knip.config.ts` (2026-09-03). They surfaced the
// moment the barrel entry glob stopped making that file a reachability root.
// They are tagged rather than deleted only because deleting them belongs with
// the rest of the cluster, in one `[internal ref]` pass.
//
// TODO(audit): delete these three with the realtime orphan cluster. Untag the
// moment a live consumer appears — a tag that outlives its reason is exactly
// the blindness the knip fix was about.
const subscriptions = new Map<string, Set<string>>()

/** @public TODO(audit): dead with the realtime orphan cluster. */
export const addSubscription = (channel: string, userId: string): void => {
  const subs = subscriptions.get(channel) ?? new Set()
  subs.add(userId)
  subscriptions.set(channel, subs)
}

/** @public TODO(audit): dead with the realtime orphan cluster. */
export const removeSubscription = (channel: string, userId: string): void => {
  const subs = subscriptions.get(channel)
  if (subs) {
    // eslint-disable-next-line drizzle/enforce-delete-with-where
    subs.delete(userId)
    if (subs.size === 0) {
      // eslint-disable-next-line drizzle/enforce-delete-with-where
      subscriptions.delete(channel)
    }
  }
}

/** @public TODO(audit): dead with the realtime orphan cluster. */
export const getSubscribers = (channel: string): readonly string[] => [
  ...(subscriptions.get(channel) ?? []),
]

// ---------------------------------------------------------------------------
// Live event fan-out (the publish/subscribe transport seam)
// ---------------------------------------------------------------------------

/**
 * A single open transport connection's listener. The SSE handler registers
 * one of these per connection; `publishToChannel` invokes every listener on
 * the target channel synchronously when a record mutation occurs.
 */
type ChannelListener = (event: Readonly<Record<string, unknown>>) => void

/**
 * Per-channel set of open-connection listeners. Distinct from `subscriptions`
 * above: `subscriptions` tracks *which users* are subscribed (presence-style
 * bookkeeping), while `listeners` holds the actual callbacks that push bytes
 * over a live wire.
 */
const listeners = new Map<string, Set<ChannelListener>>()

/**
 * Register a live listener for `channel`. Returns an unsubscribe function the
 * SSE handler MUST call when the connection closes so the listener set does
 * not leak across the process lifetime.
 */
export const addChannelListener = (channel: string, listener: ChannelListener): (() => void) => {
  const set = listeners.get(channel) ?? new Set()
  set.add(listener)
  listeners.set(channel, set)
  return () => {
    const current = listeners.get(channel)
    if (!current) return
    // eslint-disable-next-line drizzle/enforce-delete-with-where
    current.delete(listener)
    if (current.size === 0) {
      // eslint-disable-next-line drizzle/enforce-delete-with-where
      listeners.delete(channel)
    }
  }
}

/**
 * Push a change event to every open connection on `channel`. A listener that
 * throws (e.g. a connection already torn down mid-flight) is isolated so one
 * dead connection cannot block delivery to the rest.
 */
export const publishToChannel = (
  channel: string,
  event: Readonly<Record<string, unknown>>
): void => {
  const set = listeners.get(channel)
  if (!set) return
  // Snapshot to an array so a listener that unsubscribes mid-iteration cannot
  // mutate the set being walked.
  const snapshot = [...set]
  snapshot.forEach((listener) => {
    try {
      listener(event)
    } catch {
      // A torn-down connection is harmless here — its unsubscribe will run
      // from the SSE handler's stream-cancel path.
    }
  })
}

/** @public — number of open live listeners on a channel (diagnostics/tests). */
export const getChannelListenerCount = (channel: string): number =>
  listeners.get(channel)?.size ?? 0
