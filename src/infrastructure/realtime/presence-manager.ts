/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable functional/no-expression-statements, functional/immutable-data, functional/prefer-immutable-types -- in-memory presence registry intentionally mutates Maps in place */

/**
 * In-memory presence channel manager — Wave-6 presence awareness.
 *
 * A presence channel is keyed by a page path (`presence:/tasks`). When a user
 * opens a page configured with `presence: true`, their connection registers a
 * presence entry; other connections on the same page receive a `join` event,
 * and a `leave` event when the user disconnects or navigates away.
 *
 * Distinct from the table-change channel (`record-change-publisher.ts`) but
 * reuses the SAME channel-manager fan-out (`addChannelListener` /
 * `publishToChannel`) so a presence event is delivered over every open SSE
 * connection on the page-path channel.
 *
 * This is an in-process implementation — for horizontal scaling, replace the
 * per-page entry map with Redis (the channel-manager fan-out has the same
 * scaling seam already documented in `channel-manager.ts`).
 */

import { REALTIME_TRANSPORT_CONFIG } from '@/domain/models/api/realtime/realtime'
import { publishToChannel } from './channel-manager'
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

/**
 * Per-channel-key map of `connectionId → TrackedEntry`. A single user may hold
 * several connections (multiple tabs); each connection is tracked separately
 * so closing one tab does not evict the others. The key is the
 * `(appId, pagePath)` channel string returned by {@link presenceChannel}, so
 * two apps sharing a page path keep distinct entry sets.
 */
const pages = new Map<string, Map<string, TrackedEntry>>()

/** Snapshot the live presence entries for an app-scoped page channel. */
const snapshotEntries = (appId: string, pagePath: string): readonly RealtimePresenceEntry[] => {
  const page = pages.get(presenceChannel(appId, pagePath))
  if (!page) return []
  return [...page.values()].map((tracked) => tracked.entry)
}

/**
 * Evict the oldest entries from a page until there is room for one more
 * within the per-page cap. Each evicted entry broadcasts a
 * `leave` event so other connections drop it from their indicator.
 */
const evictOldestForCapacity = (
  page: Map<string, TrackedEntry>,
  appId: string,
  pagePath: string
): void => {
  const overBy = page.size - (REALTIME_TRANSPORT_CONFIG.maxPresenceEntriesPerPage - 1)
  if (overBy <= 0) return
  const oldestFirst = [...page.entries()].toSorted(([, a], [, b]) => a.lastSeen - b.lastSeen)
  oldestFirst.slice(0, overBy).forEach(([connectionId, tracked]) => {
    // eslint-disable-next-line drizzle/enforce-delete-with-where
    page.delete(connectionId)
    publishToChannel(presenceChannel(appId, pagePath), {
      type: 'leave',
      userId: tracked.entry.id,
      pagePath,
    })
  })
}

/**
 * Register a presence entry for one connection on a page path.
 *
 * Broadcasts a `join` event to every OTHER connection on the page-path
 * channel. When the page already holds the maximum number
 * of entries, the oldest entry is evicted first so the new
 * connection can join within the cap.
 *
 * Returns the full presence snapshot AFTER the join so the joining connection
 * can immediately render every colleague already on the page (the
 * `presence-sync` payload — [internal ref]).
 */
export const joinPresence = (params: {
  readonly appId: string
  readonly connectionId: string
  readonly pagePath: string
  readonly entry: RealtimePresenceEntry
}): readonly RealtimePresenceEntry[] => {
  const { appId, connectionId, pagePath, entry } = params
  const channelKey = presenceChannel(appId, pagePath)
  const page = pages.get(channelKey) ?? new Map<string, TrackedEntry>()
  pages.set(channelKey, page)

  // [internal ref]: evict the oldest entries so the new connection joins
  // within the per-page cap.
  evictOldestForCapacity(page, appId, pagePath)

  page.set(connectionId, { entry, lastSeen: Date.now() })

  // [internal ref]: announce the join to everyone already connected.
  publishToChannel(channelKey, { type: 'join', user: entry })

  return snapshotEntries(appId, pagePath)
}

/**
 * Deregister a presence entry for one connection and broadcast a `leave`
 * event to the remaining connections on the page path.
 */
export const leavePresence = (params: {
  readonly appId: string
  readonly connectionId: string
  readonly pagePath: string
}): void => {
  const { appId, connectionId, pagePath } = params
  const channelKey = presenceChannel(appId, pagePath)
  const page = pages.get(channelKey)
  if (!page) return
  const tracked = page.get(connectionId)
  if (!tracked) return
  // eslint-disable-next-line drizzle/enforce-delete-with-where
  page.delete(connectionId)
  if (page.size === 0) {
    // eslint-disable-next-line drizzle/enforce-delete-with-where
    pages.delete(channelKey)
  }
  publishToChannel(channelKey, {
    type: 'leave',
    userId: tracked.entry.id,
    pagePath,
  })
}

/**
 * Refresh a connection's `lastSeen` so an active connection is not reaped by
 * {@link reapStalePresence}.
 */
export const touchPresence = (params: {
  readonly appId: string
  readonly connectionId: string
  readonly pagePath: string
}): void => {
  const { appId, connectionId, pagePath } = params
  const tracked = pages.get(presenceChannel(appId, pagePath))?.get(connectionId)
  if (tracked) tracked.lastSeen = Date.now()
}

/**
 * Reap presence entries whose connection has not sent a heartbeat within the
 * stale window ([internal ref]: 60s — `presenceStaleTimeoutMs`).
 *
 * A reaped entry broadcasts a `leave` event so other connections drop the
 * stale user from their indicator. Each map key is the full channel string
 * returned by {@link presenceChannel} (`app:${appId}:presence:${pagePath}`);
 * the `leave` event re-publishes to that same channel and surfaces the bare
 * `pagePath` to subscribers (they never see the namespaced form).
 */
const reapStalePresence = (now: number = Date.now()): void => {
  const staleBefore = now - REALTIME_TRANSPORT_CONFIG.presenceStaleTimeoutMs
  pages.forEach((page, channelKey) => {
    // Strip the `app:${appId}:presence:` prefix to recover the original
    // pagePath for the wire-format payload. The leading two segments are
    // `app` + `<appId>` (no colons in name slugs per NameSchema), the third
    // is the literal `presence`, and everything after the 3rd colon is the
    // pagePath (which itself may contain colons in theory, so `slice` rather
    // than `split`).
    const presencePrefixEnd = channelKey.indexOf(':presence:')
    const pagePath =
      presencePrefixEnd >= 0
        ? channelKey.slice(presencePrefixEnd + ':presence:'.length)
        : channelKey
    ;[...page.entries()].forEach(([connectionId, tracked]) => {
      if (tracked.lastSeen >= staleBefore) return
      // eslint-disable-next-line drizzle/enforce-delete-with-where
      page.delete(connectionId)
      publishToChannel(channelKey, {
        type: 'leave',
        userId: tracked.entry.id,
        pagePath,
      })
    })
    if (page.size === 0) {
      // eslint-disable-next-line drizzle/enforce-delete-with-where
      pages.delete(channelKey)
    }
  })
}

// ---------------------------------------------------------------------------
// Stale-cleanup timer
// ---------------------------------------------------------------------------

/**
 * Module-level stale-cleanup interval handle. A single timer reaps stale
 * entries across every page channel. Lazily started on the
 * first presence join so a server with zero presence-enabled pages never arms
 * a timer.
 */
// eslint-disable-next-line functional/no-let
let reapTimer: ReturnType<typeof setInterval> | undefined

/** Arm the stale-cleanup timer (idempotent — safe to call on every join). */
export const startPresenceReaper = (): void => {
  if (reapTimer !== undefined) return
  reapTimer = setInterval(() => {
    reapStalePresence()
  }, REALTIME_TRANSPORT_CONFIG.presenceStaleTimeoutMs)
  // Do not keep the process alive solely for the reaper.
  if (typeof reapTimer.unref === 'function') reapTimer.unref()
}
