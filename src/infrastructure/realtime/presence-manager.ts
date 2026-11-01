/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * In-memory presence channel manager — Wave-6 presence awareness.
 *
 * A presence channel is keyed by a page path (`presence:/tasks`). When a user
 * opens a page configured with `presence: true`, their connection registers a
 * presence entry; other connections on the same page receive a `join` event,
 * and a `leave` event when the user disconnects or navigates away.
 *
 * Distinct from the table-change channel (`record-change-publisher.ts`) but
 * reuses the SAME channel fan-out so a presence event is delivered over every
 * open SSE connection on the page-path channel.
 *
 * The entries belong to one server's realtime hub (`./current-realtime-hub`):
 * built with its runtime, and reaped by a fiber of that runtime's scope
 * (`./realtime-hub-live`), so the stale-entry sweep stops with the server it
 * belongs to.
 *
 * This is an in-process implementation — for horizontal scaling, replace the
 * per-page entry map with Redis (the channel fan-out has the same scaling seam
 * already documented in `channel-manager.ts`).
 */

import { currentRealtimeHub } from './current-realtime-hub'
import type { ChannelRegistry } from './channel-manager'
import type { RealtimePresenceEntry } from '@/domain/models/api/realtime/realtime'

/**
 * Channel-name convention for a page's presence stream. A presence
 * subscription and a presence broadcast agree on a key derived from
 * `(appId, pagePath)`, so presence on `/tasks` is independent of `/projects`
 * AND independent across apps (no cross-tenant leak when
 * two apps host a page at the same path).
 */
export const presenceChannel = (appId: string, pagePath: string): string =>
  `app:${appId}:presence:${pagePath}`

/** A live presence entry plus the last time its connection was seen. */
interface TrackedEntry {
  readonly entry: RealtimePresenceEntry
  /** Epoch ms of the entry's join / last heartbeat — drives stale cleanup. */
  lastSeen: number
}

/** Which entry of which page: what one joined connection is known by. */
export interface PresenceAddress {
  readonly appId: string
  readonly connectionId: string
  readonly pagePath: string
}

/** One joined connection: what it sees on joining, and how it stays and goes. */
export interface PresenceMembership {
  /** The page's entries AFTER the join, the joining connection's own included. */
  readonly snapshot: readonly RealtimePresenceEntry[]
  /** Refresh the entry's `lastSeen`, so a connection still there is not reaped. */
  readonly touch: () => void
  /** Deregister the entry and broadcast its `leave`. Leaving twice does nothing. */
  readonly leave: () => void
}

/** One hub's presence entries. */
export interface PresenceRegistry {
  /** Register a presence entry for one connection on a page path; see {@link joinPresence}. */
  readonly join: (
    address: PresenceAddress & { readonly entry: RealtimePresenceEntry }
  ) => PresenceMembership
  /**
   * Reap the entries last seen before `now - staleAfterMs`, broadcasting each
   * one's `leave`. Answers how many were reaped.
   */
  readonly reapStale: (now: number, staleAfterMs: number) => number
  /** Forget every entry — the hub's release. */
  readonly clear: () => void
}

/**
 * The bare `pagePath` of a presence channel key. Each key is the full channel
 * string returned by {@link presenceChannel} (`app:${appId}:presence:${pagePath}`);
 * the leading two segments are `app` + `<appId>` (no colons in name slugs per
 * NameSchema), the third is the literal `presence`, and everything after it is
 * the pagePath, which itself may contain colons in theory, so `slice` rather
 * than `split`.
 */
const pagePathOfChannel = (channelKey: string): string => {
  const presencePrefixEnd = channelKey.indexOf(':presence:')
  return presencePrefixEnd >= 0
    ? channelKey.slice(presencePrefixEnd + ':presence:'.length)
    : channelKey
}

/**
 * Per-channel-key map of `connectionId → TrackedEntry`. A single user may hold
 * several connections (multiple tabs); each connection is tracked separately so
 * closing one tab does not evict the others. The key is the `(appId, pagePath)`
 * channel string returned by {@link presenceChannel}, so two apps sharing a page
 * path keep distinct entry sets.
 */
type PresencePages = Map<string, Map<string, TrackedEntry>>

/** Where a registry broadcasts, and how many entries one page holds. */
interface PresenceWiring {
  readonly channels: Pick<ChannelRegistry, 'publish'>
  readonly maxEntriesPerPage: number
}

const broadcastLeave = (
  wiring: PresenceWiring,
  channelKey: string,
  tracked: TrackedEntry,
  pagePath: string
): void => {
  wiring.channels.publish(channelKey, { type: 'leave', userId: tracked.entry.id, pagePath })
}

/**
 * Evict the oldest entries from a page until there is room for one more within
 * the per-page cap. Each evicted entry broadcasts a `leave` event so other
 * connections drop it from their indicator.
 */
const evictOldestForCapacity = (
  wiring: PresenceWiring,
  page: Map<string, TrackedEntry>,
  channelKey: string,
  pagePath: string
): void => {
  const overBy = page.size - (wiring.maxEntriesPerPage - 1)
  if (overBy <= 0) return
  const oldestFirst = [...page.entries()].toSorted(([, a], [, b]) => a.lastSeen - b.lastSeen)
  oldestFirst.slice(0, overBy).forEach(([connectionId, tracked]) => {
    page.delete(connectionId)
    broadcastLeave(wiring, channelKey, tracked, pagePath)
  })
}

const leaveIn = (pages: PresencePages, wiring: PresenceWiring, address: PresenceAddress): void => {
  const { appId, connectionId, pagePath } = address
  const channelKey = presenceChannel(appId, pagePath)
  const page = pages.get(channelKey)
  if (!page) return
  const tracked = page.get(connectionId)
  if (!tracked) return
  page.delete(connectionId)
  if (page.size === 0) {
    pages.delete(channelKey)
  }
  broadcastLeave(wiring, channelKey, tracked, pagePath)
}

const touchIn = (pages: PresencePages, address: PresenceAddress): void => {
  const { appId, connectionId, pagePath } = address
  const tracked = pages.get(presenceChannel(appId, pagePath))?.get(connectionId)
  if (tracked) tracked.lastSeen = Date.now()
}

const joinIn = (
  pages: PresencePages,
  wiring: PresenceWiring,
  address: PresenceAddress & { readonly entry: RealtimePresenceEntry }
): PresenceMembership => {
  const { appId, connectionId, pagePath, entry } = address
  const channelKey = presenceChannel(appId, pagePath)
  const page = pages.get(channelKey) ?? new Map<string, TrackedEntry>()
  pages.set(channelKey, page)
  // Evict the oldest entries so the new connection joins within the per-page cap.
  evictOldestForCapacity(wiring, page, channelKey, pagePath)
  page.set(connectionId, { entry, lastSeen: Date.now() })
  // Announce the join to everyone already connected.
  wiring.channels.publish(channelKey, { type: 'join', user: entry })
  return {
    snapshot: [...page.values()].map((tracked) => tracked.entry),
    touch: () => touchIn(pages, address),
    leave: () => leaveIn(pages, wiring, address),
  }
}

const reapIn = (
  pages: PresencePages,
  wiring: PresenceWiring,
  now: number,
  staleAfterMs: number
): number => {
  const staleBefore = now - staleAfterMs
  return [...pages.entries()].reduce((reaped, [channelKey, page]) => {
    const pagePath = pagePathOfChannel(channelKey)
    const stale = [...page.entries()].filter(([, tracked]) => tracked.lastSeen < staleBefore)
    stale.forEach(([connectionId, tracked]) => {
      page.delete(connectionId)
      broadcastLeave(wiring, channelKey, tracked, pagePath)
    })
    if (page.size === 0) {
      pages.delete(channelKey)
    }
    return reaped + stale.length
  }, 0)
}

/** A fresh registry with nobody on any page, broadcasting through `channels`. */
export const makePresenceRegistry = (
  channels: Pick<ChannelRegistry, 'publish'>,
  maxEntriesPerPage: number
): PresenceRegistry => {
  const pages: PresencePages = new Map()
  const wiring: PresenceWiring = { channels, maxEntriesPerPage }
  return {
    join: (address) => joinIn(pages, wiring, address),
    reapStale: (now, staleAfterMs) => reapIn(pages, wiring, now, staleAfterMs),
    clear: () => {
      pages.clear()
    },
  }
}

/** A membership that holds nothing: what a join answers with no server running. */
const NO_MEMBERSHIP: PresenceMembership = {
  snapshot: [],
  touch: () => undefined,
  leave: () => undefined,
}

/**
 * Register a presence entry for one connection on a page path, on the running
 * server's hub.
 *
 * Broadcasts a `join` event to every OTHER connection on the page-path
 * channel. When the page already holds the maximum number of entries, the
 * oldest entry is evicted first so the new connection can join within the cap.
 *
 * Answers the full presence snapshot AFTER the join, so the joining connection
 * can immediately render every colleague already on the page (the
 * `presence-sync` payload — a realtime spec), and the `touch` and `leave` of
 * this entry, bound to the hub it joined: a connection that closes after its
 * server stopped never reaches into the next one's.
 */
export const joinPresence = (
  address: PresenceAddress & { readonly entry: RealtimePresenceEntry }
): PresenceMembership => currentRealtimeHub()?.presence.join(address) ?? NO_MEMBERSHIP
