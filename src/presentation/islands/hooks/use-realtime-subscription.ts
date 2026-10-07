/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useRef, useState } from 'react'
import type { RealtimeConnectionStatus } from '@/domain/models/api/realtime/realtime'

/** Logical connectivity state of the realtime transport. */
export type RealtimeConnectionState = RealtimeConnectionStatus['status']

/** A data source's refresh strategy, as `dataSource.refreshMode` declares it. */
export type RefreshMode = 'none' | 'poll' | 'realtime'

/** Default poll interval (30s) when `refreshMode: 'poll'` and no interval given. */
const DEFAULT_POLL_INTERVAL_MS = 30_000

/**
 * Background re-read cadence for `refreshMode: 'realtime'`.
 *
 * Realtime mode is push-driven: a `change` frame re-reads at once. This
 * interval is only a *resilience fallback* — it bridges a dropped connection
 * between reconnects, and on the grid it also reconciles an out-of-band write
 * (a direct database write the change feed never sees).
 *
 * 3s catches such a write within a few seconds while 20 reads a minute stays
 * under the 100-req/60s `GET:/api/tables/*` limit. (The subscribe endpoint
 * itself is exempt from that limiter — see `isRealtimeSubscriptionPath`.)
 */
const REALTIME_FALLBACK_POLL_MS = 3000

/**
 * The re-read interval for a refresh mode: `pollIntervalMs` (30s by default)
 * when polling, the short fallback in realtime, none otherwise.
 */
export const resolveRefetchInterval = (
  refreshMode: RefreshMode | undefined,
  pollIntervalMs: number | undefined
): number | false =>
  refreshMode === 'poll'
    ? (pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS)
    : refreshMode === 'realtime'
      ? REALTIME_FALLBACK_POLL_MS
      : false

/**
 * One island following a table's change feed: called with `'change'` when the
 * table changed (or a `resync` asks for a re-read), else with the feed's new
 * connection state.
 */
type FeedSubscriber = (frame: 'change' | RealtimeConnectionState) => void

/** A table's change feed, shared by every island on the page that follows it. */
interface Feed {
  readonly source: EventSource
  readonly subs: Set<FeedSubscriber>
  state: RealtimeConnectionState
}

/**
 * The page's open feeds, one per table. Module state is page state: every
 * island imports this module from the same chunk URL, so they share it.
 *
 * Sharing is part of the contract, not an optimisation: each signed-in
 * person may hold ten subscriptions, and a dashboard of six realtime components
 * over one table would otherwise spend six of them.
 */
const feeds = new Map<string, Feed>()

const openFeed = (table: string): Feed => {
  const source = new EventSource(`/api/tables/${encodeURIComponent(table)}/subscribe`)
  const feed: Feed = { source, subs: new Set(), state: 'reconnecting' }
  const send = (frame: 'change' | RealtimeConnectionState) => {
    if (frame !== 'change') feed.state = frame
    feed.subs.forEach((sub) => sub(frame))
  }
  let reopened = false
  source.onmessage = (event: MessageEvent) => {
    try {
      // A `change` warrants a re-read, and so does a `resync` — the notice a
      // write too large to announce row by row sends instead; `subscribed`/
      // `heartbeat` are keepalive noise.
      const { type } = JSON.parse(event.data) as { type?: string }
      if (type === 'change' || type === 'resync') send('change')
    } catch {
      // Malformed frame — ignore; the next valid event will refresh.
    }
  }
  // The server buffers nothing, so a change published while the feed was
  // between streams (a Server-Sent-Events stream lasts at most 25 s) never
  // arrives: every RE-opened stream asks its subscribers to read once more.
  source.onopen = () => {
    if (reopened) send('change')
    reopened = true
    send('connected')
  }
  // `readyState === CLOSED` (2) means the browser gave up reconnecting (a `404`
  // on a reconnect the server now refuses); any other state is a retry in flight.
  // A feed the browser gave up on leaves the page's map, so the next island to
  // join (a later SPA swap, a remount) opens a fresh stream rather than
  // inheriting a dead one; its current subscribers stay on their fallback poll.
  source.onerror = () => {
    const gaveUp = source.readyState === 2
    if (gaveUp) feeds.delete(table)
    send(gaveUp ? 'disconnected' : 'reconnecting')
  }
  return feed
}

/**
 * Join a table's feed, opening it for the first subscriber; the returned leave
 * closes it after the last. Exported for its unit test.
 */
export const joinFeed = (table: string, sub: FeedSubscriber): (() => void) => {
  const feed = feeds.get(table) ?? openFeed(table)
  feeds.set(table, feed)
  feed.subs.add(sub)
  sub(feed.state)
  return () => {
    feed.subs.delete(sub)
    if (feed.subs.size > 0) return
    // Only evict the map entry if it is still this feed: a replaced (given-up)
    // feed's last leave must not close the fresh one that took its place.
    if (feeds.get(table) === feed) feeds.delete(table)
    feed.source.close()
  }
}

/**
 * Live realtime subscription for a data-bound island.
 *
 * When a data source declares `refreshMode: 'realtime'`, the island follows
 * `GET /api/tables/:table/subscribe` and `onChange` runs whenever the server
 * pushes a `change` (or `resync`) for the table. Every island on the page
 * following the same table shares ONE `EventSource`, reference-counted and
 * closed when the last of them leaves.
 *
 * The island answers `onChange` by reading again through its usual API read,
 * so the server applies the data source's filter and sort — the client never
 * re-implements the predicate.
 *
 * The browser `EventSource` auto-reconnects when the server closes the stream
 * — after its bounded lifetime, or at once when the subscriber's grant changes
 * — so a long-lived page keeps receiving events, judged against its current
 * grant. The connection state is the shared feed's:
 * `connected` once open, `reconnecting` while a retry is in flight,
 * `disconnected` once the browser gives up.
 */
export function useRealtimeSubscription(params: {
  readonly enabled: boolean
  readonly table: string
  readonly onChange: () => void
}): RealtimeConnectionState | undefined {
  const { enabled, table, onChange } = params
  const [status, setStatus] = useState<RealtimeConnectionState>('reconnecting')

  // `onChange` is read through a ref, and the effect below does NOT depend on
  // it. That is load-bearing: the grid's handler has a new identity on every
  // render, and re-joining on each render once dropped changes published in
  // the gap (the server buffers nothing). The subscription depends only on
  // whether realtime is on and which table it follows.
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(
    () =>
      enabled
        ? joinFeed(table, (frame) =>
            frame === 'change' ? onChangeRef.current() : setStatus(frame)
          )
        : undefined,
    [enabled, table]
  )

  return enabled ? status : undefined
}

/** The binding keys live refresh reads off a data source. */
export interface LiveRefreshSource {
  readonly table?: string
  readonly view?: string
  readonly refreshMode?: RefreshMode
  readonly pollIntervalMs?: number
}

/**
 * Keep a list, a board, a KPI or a chart current, as `dataSource.refreshMode`
 * asks: `poll` calls `reread` every `pollIntervalMs`; `realtime` calls it on
 * every change to the table, through the page's shared feed (and once on every
 * reconnection, see `openFeed`), and on the short fallback interval only while that feed is not
 * connected — a connected feed already announces every write the engine makes,
 * and polling beside it would spend the caller's read budget once per
 * component. A write made straight to the database is therefore seen at the
 * next change or reconnection, not within the fallback interval as on the grid.
 *
 * A view-bound or system-bound binding stays static: a view's rows are not the
 * table's change feed. A hidden tab skips its polls.
 */
export function useLiveRefresh(source: LiveRefreshSource | undefined, reread: () => unknown): void {
  const mode =
    source?.table !== undefined && source.view === undefined ? source.refreshMode : undefined
  const rereadRef = useRef(reread)
  rereadRef.current = reread
  const status = useRealtimeSubscription({
    enabled: mode === 'realtime',
    table: source?.table ?? '',
    onChange: () => void rereadRef.current(),
  })
  const every =
    status === 'connected' ? false : resolveRefetchInterval(mode, source?.pollIntervalMs)
  useEffect(() => {
    if (every === false) return undefined
    const timer = setInterval(() => {
      if (!document.hidden) void rereadRef.current()
    }, every)
    return () => clearInterval(timer)
  }, [every])
}
