/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * In-memory channel subscription manager.
 *
 * Fans out live change events to every open transport connection on a channel.
 * The listener sets belong to one server's realtime hub
 * (`./current-realtime-hub`): built with its runtime, dropped with it.
 *
 * This is an in-process implementation — for horizontal scaling, replace the
 * per-channel listener set with Redis pub/sub or a dedicated message broker.
 */

import { currentRealtimeHub } from './current-realtime-hub'

// ---------------------------------------------------------------------------
// Live event fan-out (the publish/subscribe transport seam)
// ---------------------------------------------------------------------------

/**
 * A single open transport connection's listener. The SSE handler registers
 * one of these per connection; `publishToChannel` invokes every listener on
 * the target channel synchronously when a record mutation occurs.
 */
type ChannelListener = (event: Readonly<Record<string, unknown>>) => void

/** One hub's channels: the callbacks that push bytes over a live wire, per channel. */
export interface ChannelRegistry {
  readonly addListener: (channel: string, listener: ChannelListener) => () => void
  readonly publish: (channel: string, event: Readonly<Record<string, unknown>>) => void
  readonly listenerCount: (channel: string) => number
  /** Forget every listener — the hub's release. */
  readonly clear: () => void
}

/** A fresh, empty channel registry. */
export const makeChannelRegistry = (): ChannelRegistry => {
  const listeners = new Map<string, Set<ChannelListener>>()
  return {
    addListener: (channel, listener) => {
      const set = listeners.get(channel) ?? new Set()
      set.add(listener)
      listeners.set(channel, set)
      return () => {
        const current = listeners.get(channel)
        if (!current) return
        current.delete(listener)
        if (current.size === 0) {
          listeners.delete(channel)
        }
      }
    },
    publish: (channel, event) => {
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
    },
    listenerCount: (channel) => listeners.get(channel)?.size ?? 0,
    clear: () => {
      listeners.clear()
    },
  }
}

/**
 * Register a live listener for `channel` on the running server's hub. Returns
 * an unsubscribe function the SSE handler MUST call when the connection closes
 * so the listener set does not leak across the server's lifetime. With no
 * server running there is nothing to listen to, and the unsubscribe does
 * nothing.
 */
export const addChannelListener = (channel: string, listener: ChannelListener): (() => void) =>
  currentRealtimeHub()?.channels.addListener(channel, listener) ?? (() => undefined)

/**
 * Push a change event to every open connection on `channel`. A listener that
 * throws (e.g. a connection already torn down mid-flight) is isolated so one
 * dead connection cannot block delivery to the rest. A no-op with no server
 * running: nobody can be listening.
 */
export const publishToChannel = (
  channel: string,
  event: Readonly<Record<string, unknown>>
): void => {
  currentRealtimeHub()?.channels.publish(channel, event)
}

/** @public — number of open live listeners on a channel (diagnostics/tests). */
export const getChannelListenerCount = (channel: string): number =>
  currentRealtimeHub()?.channels.listenerCount(channel) ?? 0
