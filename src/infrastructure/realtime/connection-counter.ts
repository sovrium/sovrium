/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The registry of live realtime-transport connections, keyed by user and by
 * the session each connection opened with.
 *
 * It does four things:
 *
 *  1. **Caps concurrent connections** per user, in two separate pools of
 *     `REALTIME_TRANSPORT_CONFIG.maxConnectionsPerUser` each: record
 *     subscriptions, and presence streams. A new connection beyond its pool's
 *     cap is refused and the route answers HTTP 429 + `Retry-After`. The pools
 *     are separate so a page's presence stream never takes the slot of one of
 *     its record subscriptions, while a presence stream is still bounded.
 *  2. **Closes a user's connections when their grant changes.** Each transport
 *     binds a `close` to its registration — an SSE stream ends, a WebSocket is
 *     closed with the code it is handed — and {@link closeUserConnections}
 *     runs them all with the grant-changed code. The in-process doors that
 *     change a grant (a role change, a group membership, a `user_access`
 *     grant) call it, so the client reconnects and is judged again at the
 *     handshake, the only place a grant is resolved.
 *  3. **Closes a session's connections when that session ends**
 *     ({@link closeSessionConnections}), with the session-ended code: a
 *     reconnect would be refused, so the client signs in again instead. Only
 *     that session's connections close; the same person's other sessions keep
 *     theirs.
 *  4. **Re-checks long-lived connections** every `grantRecheckIntervalMs`, for
 *     a change made outside those doors. The sweep first asks whether each
 *     connection's session is still alive — one read per batch — and closes a
 *     dead one with the session-ended code; a living one goes on to its
 *     transport's `recheck`, which resolves the grant again. All connections
 *     share one {@link RecheckSweep.memo}, so a user holding several
 *     connections to one table costs one resolution per sweep.
 *
 * A connection is closed at most once, whichever door reaches it first: a ban
 * ends the account's sessions (closing with session-ended) before the ban's
 * own grant-change close runs, and that second close is a no-op.
 *
 * Scoped per process. For horizontal scaling the counts and the close fan-out
 * would move to a shared store; the public functions stay the same.
 */

import { REALTIME_TRANSPORT_CONFIG } from '@/domain/models/api/realtime/realtime'
import { logError } from '@/infrastructure/logging/logger'
import { readLiveSessionIds } from './session-liveness-queries'

/** Why a connection is being closed: the WebSocket close code and reason it carries. */
export interface ConnectionCloseCause {
  readonly code: number
  readonly reason: 'grant-changed' | 'session-ended'
}

/** The subscriber's grant changed: reconnect, and be judged again. */
export const GRANT_CHANGED: ConnectionCloseCause = {
  code: REALTIME_TRANSPORT_CONFIG.grantChangedCloseCode,
  reason: 'grant-changed',
}

/** The session the connection opened with has ended: sign in again, do not reconnect. */
export const SESSION_ENDED: ConnectionCloseCause = {
  code: REALTIME_TRANSPORT_CONFIG.sessionEndedCloseCode,
  reason: 'session-ended',
}

/** One re-check sweep, shared by every connection it judges. */
export interface RecheckSweep {
  /**
   * Compute `key` once per sweep: the first caller's promise is handed to every
   * later caller asking for the same key, so a resolution shared by several
   * connections (the same user on the same table) runs once.
   */
  readonly memo: <A>(key: string, compute: () => Promise<A>) => Promise<A>
}

/** What a transport binds to its registration once the connection is open. */
export interface ConnectionHooks {
  /** End the connection for `cause`. The registry calls it at most once. */
  readonly close: (cause: ConnectionCloseCause) => void
  /**
   * Resolve the grant again and answer whether it still matches the one the
   * connection opened with. Omitted by a transport whose lifetime is already
   * shorter than the re-check interval.
   */
  readonly recheck?: (sweep: RecheckSweep) => Promise<boolean>
}

/**
 * The per-user cap a connection counts against: a record subscription, or a
 * presence stream. Each pool holds `maxConnectionsPerUser` connections.
 */
export type ConnectionPool = 'subscription' | 'presence'

interface ConnectionEntry {
  readonly userId: string
  readonly sessionId: string
  /** The per-user cap the entry counts against. */
  readonly pool: ConnectionPool
  hooks: ConnectionHooks | undefined
  closed: boolean
}

/** Live connections per user. A user with no connection has no entry. */
const userConnections = new Map<string, Set<ConnectionEntry>>()

/** Live connections per session. A session with no connection has no entry. */
const sessionConnections = new Map<string, Set<ConnectionEntry>>()

/** The re-check ticker — running only while some connection can be re-checked. */
let recheckTimer: ReturnType<typeof setInterval> | undefined = undefined

let sweepInFlight = false

/**
 * Result of attempting to register one more connection for a user.
 *
 * `accepted` carries a `release` thunk the caller MUST invoke when the
 * connection terminates (SSE teardown, WebSocket `onClose`) so the registry
 * does not leak, and a `bind` the transport calls once the connection is open
 * to hand over how it is closed and re-checked.
 */
export type ConnectionRegistration =
  | {
      readonly accepted: true
      readonly release: () => void
      readonly bind: (hooks: ConnectionHooks) => void
    }
  | { readonly accepted: false; readonly current: number; readonly limit: number }

const hasRecheckableConnection = (): boolean =>
  [...userConnections.values()].some((entries) =>
    [...entries].some((entry) => entry.hooks?.recheck !== undefined)
  )

const stopRecheckTimerWhenIdle = (): void => {
  if (recheckTimer === undefined || hasRecheckableConnection()) return
  clearInterval(recheckTimer)
  recheckTimer = undefined
}

const ensureRecheckTimer = (): void => {
  if (recheckTimer !== undefined) return
  recheckTimer = setInterval(() => {
    void recheckConnections()
  }, REALTIME_TRANSPORT_CONFIG.grantRecheckIntervalMs)
  // The ticker never keeps a process alive on its own.
  recheckTimer.unref?.()
}

const addTo = (
  index: Map<string, Set<ConnectionEntry>>,
  key: string,
  entry: ConnectionEntry
): void => {
  const entries = index.get(key) ?? new Set<ConnectionEntry>()
  entries.add(entry)
  index.set(key, entries)
}

const removeFrom = (
  index: Map<string, Set<ConnectionEntry>>,
  key: string,
  entry: ConnectionEntry
): void => {
  const entries = index.get(key)
  if (entries === undefined) return
  entries.delete(entry)
  if (entries.size === 0) index.delete(key)
}

/** How many of `userId`'s live connections count against `pool`. */
const poolCount = (userId: string, pool: ConnectionPool): number =>
  [...(userConnections.get(userId) ?? [])].filter((entry) => entry.pool === pool).length

/**
 * Attempt to register a new connection for `userId`, opened with the session
 * `sessionId`. Returns an accepting registration, or a rejection with the
 * observed `current` count and the configured `limit` so the route can produce
 * a precise 429 body.
 *
 * `options.pool: 'presence'` registers a presence stream, which a page opens
 * beside its record subscriptions: it counts against its own per-user cap,
 * never against the record subscriptions', and every closing door reaches it.
 *
 * `release` is idempotent — a connection's several teardown paths may all call
 * it without releasing a slot twice.
 */
export const registerConnection = (
  userId: string,
  sessionId: string,
  options: { readonly pool?: ConnectionPool } = {}
): ConnectionRegistration => {
  const pool = options.pool ?? 'subscription'
  const limit = REALTIME_TRANSPORT_CONFIG.maxConnectionsPerUser
  const current = poolCount(userId, pool)
  if (current >= limit) {
    return { accepted: false, current, limit }
  }
  const entry: ConnectionEntry = { userId, sessionId, pool, hooks: undefined, closed: false }
  addTo(userConnections, userId, entry)
  addTo(sessionConnections, sessionId, entry)
  return {
    accepted: true,
    release: () => {
      if (userConnections.get(userId)?.has(entry) !== true) return
      removeFrom(userConnections, userId, entry)
      removeFrom(sessionConnections, sessionId, entry)
      stopRecheckTimerWhenIdle()
    },
    bind: (hooks) => {
      entry.hooks = hooks
      if (hooks.recheck !== undefined) ensureRecheckTimer()
    },
  }
}

/**
 * Run one entry's `close` for `cause`, never letting a transport's fault stop
 * the fan-out. Idempotent: an entry already closed — by another door, a moment
 * earlier — is left alone and not counted.
 */
const closeEntry = (entry: ConnectionEntry, cause: ConnectionCloseCause): boolean => {
  if (entry.hooks === undefined || entry.closed) return false
  entry.closed = true
  try {
    entry.hooks.close(cause)
    return true
  } catch (error) {
    logError('[realtime] closing a connection failed', error, {
      userId: entry.userId,
      reason: cause.reason,
    })
    return false
  }
}

const closeAll = (
  entries: ReadonlySet<ConnectionEntry> | undefined,
  cause: ConnectionCloseCause
): number => [...(entries ?? [])].filter((entry) => closeEntry(entry, cause)).length

/**
 * Close every live connection of `userId`. Returns how many were closed. The
 * cause defaults to a grant change; the account-erasure purge, which ends the
 * account's sessions by cascade rather than through Better Auth, passes
 * {@link SESSION_ENDED}. A connection that has not bound its hooks yet (still
 * in its handshake) is left alone: its handshake resolves the grant as it
 * stands now.
 */
export const closeUserConnections = (
  userId: string,
  cause: ConnectionCloseCause = GRANT_CHANGED
): number => closeAll(userConnections.get(userId), cause)

/**
 * Close every live connection opened with the session `sessionId`, because
 * that session ended. Returns how many were closed. The same person's
 * connections opened with another session stay open.
 */
export const closeSessionConnections = (sessionId: string): number =>
  closeAll(sessionConnections.get(sessionId), SESSION_ENDED)

const newSweep = (): RecheckSweep => {
  const results = new Map<string, Promise<unknown>>()
  return {
    memo: <A>(key: string, compute: () => Promise<A>): Promise<A> => {
      const known = results.get(key)
      if (known !== undefined) return known as Promise<A>
      const computed = compute()
      results.set(key, computed)
      return computed
    },
  }
}

/** Answers which of the given session ids are still alive; rejects when it cannot tell. */
export type LiveSessionReader = (sessionIds: readonly string[]) => Promise<ReadonlySet<string>>

/**
 * What the sweep knows of a session it asked about: alive, dead, or unknown
 * (the read failed).
 */
type SessionState = 'alive' | 'dead' | 'unknown'

/**
 * Settle, in ONE read, the state of every session of `batch` the sweep has not
 * asked about yet — so a session shared by connections in several batches is
 * read once per sweep.
 */
const settleSessionStates = async (
  batch: readonly ConnectionEntry[],
  known: Map<string, SessionState>,
  readLiveSessions: LiveSessionReader
): Promise<void> => {
  const unasked = [...new Set(batch.map((entry) => entry.sessionId))].filter(
    (sessionId) => !known.has(sessionId)
  )
  if (unasked.length === 0) return
  const live = await readLiveSessions(unasked).catch((error: unknown) => {
    logError('[realtime] reading session liveness failed; closing the connections', error, {
      sessions: String(unasked.length),
    })
    return undefined
  })
  unasked.forEach((sessionId) => {
    known.set(sessionId, live === undefined ? 'unknown' : live.has(sessionId) ? 'alive' : 'dead')
  })
}

/**
 * Re-check one connection whose session state is settled: a dead session
 * closes it with the session-ended code, without resolving any grant; a living
 * one is judged by its transport's `recheck`. A question that cannot be
 * answered — the session read or the grant read failed — closes it with the
 * grant-changed code: the reconnect is judged at the handshake, which fails
 * closed the same way.
 */
const recheckEntry = async (
  entry: ConnectionEntry,
  session: SessionState,
  sweep: RecheckSweep
): Promise<boolean> => {
  const recheck = entry.hooks?.recheck
  if (recheck === undefined) return false
  if (session === 'dead') return closeEntry(entry, SESSION_ENDED)
  if (session === 'unknown') return closeEntry(entry, GRANT_CHANGED)
  const stillGranted = await recheck(sweep).catch((error: unknown) => {
    logError('[realtime] re-checking a connection grant failed; closing it', error, {
      userId: entry.userId,
    })
    return false
  })
  return stillGranted ? false : closeEntry(entry, GRANT_CHANGED)
}

/**
 * How many connections a sweep re-checks at once. Each re-check may read the
 * database, so a server holding thousands of sockets spreads a sweep over
 * batches rather than issuing every read in the same tick.
 */
const RECHECK_BATCH_SIZE = 16

/** `items` cut into consecutive batches of at most `size`. */
const batchesOf = <A>(items: readonly A[], size: number): readonly (readonly A[])[] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size)
  )

/**
 * Re-check every connection that bound a `recheck`, closing those whose
 * session ended or whose grant no longer matches. Returns how many were
 * closed. Runs on the ticker, in batches of {@link RECHECK_BATCH_SIZE}, each
 * costing one session read plus the grant resolutions its living sessions
 * need; exported for tests and for a caller that wants a sweep now.
 */
export const recheckConnections = async (
  readLiveSessions: LiveSessionReader = readLiveSessionIds
): Promise<number> => {
  if (sweepInFlight) return 0
  sweepInFlight = true
  try {
    const sweep = newSweep()
    const sessions = new Map<string, SessionState>()
    const entries = [...userConnections.values()].flatMap((set) =>
      [...set].filter((entry) => entry.hooks?.recheck !== undefined && !entry.closed)
    )
    return await batchesOf(entries, RECHECK_BATCH_SIZE).reduce<Promise<number>>(
      async (closedSoFar, batch) => {
        const before = await closedSoFar
        await settleSessionStates(batch, sessions, readLiveSessions)
        const closed = await Promise.all(
          batch.map((entry) =>
            recheckEntry(entry, sessions.get(entry.sessionId) ?? 'unknown', sweep)
          )
        )
        return before + closed.filter(Boolean).length
      },
      Promise.resolve(0)
    )
  } finally {
    sweepInFlight = false
  }
}

/** Diagnostics / tests — `userId`'s live connections in `pool` (0 if none). */
export const getConnectionCount = (userId: string, pool: ConnectionPool = 'subscription'): number =>
  poolCount(userId, pool)

/** Diagnostics / tests — reset the registry and stop the ticker (test teardown only). */
export const resetConnectionCountersForTesting = (): void => {
  userConnections.clear()
  sessionConnections.clear()
  if (recheckTimer !== undefined) clearInterval(recheckTimer)
  recheckTimer = undefined
  sweepInFlight = false
}
