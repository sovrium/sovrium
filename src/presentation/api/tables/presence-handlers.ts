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
 *
 * Audience: presence is served only for a `pagePath` that is a declared page
 * declaring `presence: true` whose `access` admits the caller — the decision a
 * visit to the page is judged on (`resolvePresencePage`) — and, on a record
 * page, only at the address of a record she may read (`admitsPresenceRecord`).
 * Any other path answers the same 404 and names nobody, so presence can neither
 * be read nor written for a page or record the caller may not open.
 * {@link admitPresence} is the one place every such check is made.
 *
 * Cap: a presence stream counts against its own per-user cap — ten streams,
 * as a record subscription counts against its — and the eleventh is answered
 * 429 + `Retry-After` before anything is joined.
 *
 * Revocation: the stream is registered with the realtime connection registry,
 * so the doors that end a record subscription — a grant change,
 * the end of its session — end it too; and a write to a record it watches
 * judges the record rule again ({@link watchRecordsForRevocation}).
 */

import { Effect, Queue, Stream } from 'effect'
import { resolvePresencePage } from '@/domain/models/app/pages/page-presence-access-service'
import { logError } from '@/infrastructure/logging/logger'
import { addChannelListener } from '@/infrastructure/realtime/channel-manager'
import {
  registerConnection,
  type ConnectionRegistration,
} from '@/infrastructure/realtime/connection-counter'
import {
  joinPresence,
  leavePresence,
  presenceChannel,
  startPresenceReaper,
  touchPresence,
} from '@/infrastructure/realtime/presence-manager'
import { resolvePresenceUser } from '@/infrastructure/realtime/presence-queries'
import { tableChannel } from '@/infrastructure/realtime/record-change-publisher'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import { runEffectSse } from '@/presentation/api/runtime/effect-sse'
import { admitsPresenceRecord, type WatchedRecord } from './presence-record-gate'
import { tooManyConnectionsResponse } from './subscribe-handlers'
import type { RealtimePresenceEntry } from '@/domain/models/api/realtime/realtime'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { DeclaredPageMatch } from '@/domain/models/app/pages/page-path-resolvability'
import type { Cause } from 'effect'
import type { Context } from 'hono'

/** The router's own session reader, the one a page visit is judged on. */
export type PresenceReaderResolver = (headers: Headers) => Promise<SessionInfo | undefined>

/**
 * Whether the caller may see, and be shown in, presence on `pagePath`, and the
 * records whose writes must judge her stream again.
 *
 * The page rule: a declared page with `presence: true` whose `access` admits
 * her. The record rule, on a page showing one record: watching `/orders/42` is
 * reading order 42, so it is judged on the same match — its `params` and the
 * page's bound table — by the records API's rules.
 */
async function admitPresence(
  c: Context,
  app: App,
  pagePath: string,
  getSession: PresenceReaderResolver | undefined
): Promise<
  { readonly match: DeclaredPageMatch; readonly watched: readonly WatchedRecord[] } | undefined
> {
  const reader = getSession === undefined ? undefined : await getSession(c.req.raw.headers)
  const match = resolvePresencePage(app, pagePath, reader)
  if (match === undefined) return undefined
  const verdict = await admitsPresenceRecord(c, app, match)
  return verdict.admitted ? { match, watched: verdict.watched } : undefined
}

/**
 * Listen for writes to the records a stream watches, and end the stream the
 * first time one of them leaves its viewer: a write to a watched record (or a
 * bulk write to its table, announced without per-row events) judges the
 * record rule again, as the handshake did; a refusal — the record moved out of
 * her row-level rule, was deleted, or no longer sits at the address — ends the
 * stream, and her `leave` is broadcast on the way out.
 */
function watchRecordsForRevocation(input: {
  readonly c: Context
  readonly app: App
  readonly match: DeclaredPageMatch
  readonly watched: readonly WatchedRecord[]
  readonly end: () => void
}): () => void {
  const { c, app, match, watched, end } = input
  const tables = [...new Set(watched.map((record) => record.table))]
  const touchesWatched = (table: string, event: Readonly<Record<string, unknown>>): boolean =>
    event.type === 'resync' ||
    (event.type === 'change' &&
      watched.some((record) => record.table === table && record.recordId === event.recordId))
  const rejudge = (): void => {
    // eslint-disable-next-line functional/no-expression-statements -- fire-and-forget re-judgement; a failure to judge ends the stream
    void admitsPresenceRecord(c, app, match)
      .then((verdict) => verdict.admitted)
      .catch((error: unknown) => {
        logError('[presence] re-judgement failed; ending the stream', error)
        return false
      })
      .then((admitted) => {
        if (!admitted) end()
      })
  }
  const unsubscribes = tables.map((table) =>
    addChannelListener(tableChannel(app.name, table), (event) => {
      if (touchesWatched(table, event)) rejudge()
    })
  )
  return () => unsubscribes.forEach((unsubscribe) => unsubscribe())
}

/**
 * Handle `GET /api/realtime/presence`.
 *
 * Requires an authenticated session (401 otherwise) and a `pagePath` query
 * param identifying the page-path presence channel to join. The channel is
 * namespaced by `app.name` to prevent cross-tenant leakage when more than
 * one app shares a process.
 */
export async function handlePresence(
  c: Context,
  app: App,
  getSession?: PresenceReaderResolver
): Promise<Response> {
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

  // A page the caller may not open, a page without presence and a path that is
  // no page all answer this one 404 — before anything is joined or read.
  const admitted = await admitPresence(c, app, pagePath, getSession)
  if (admitted === undefined) return notFound(c)

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

  // The stream counts against her presence cap: past it, the request is
  // answered 429 before anything is joined or broadcast.
  const registration = registerConnection(session.userId, session.id, { pool: 'presence' })
  if (!registration.accepted) {
    return tooManyConnectionsResponse(c, registration.current, registration.limit)
  }

  // Each connection (browser tab) gets a distinct presence entry so closing
  // one tab does not evict another tab of the same user.
  const connectionId = crypto.randomUUID()

  // Register the entry + broadcast `join` to other connections, then surface
  // the resulting snapshot in the preamble so the joining user sees every
  // colleague already on the page. `leavePresence` is fired by the bridge's
  // `onTerminate` callback for ALL termination reasons (clean close, lifetime
  // timeout, client navigation/abort, revocation). The channel is namespaced
  // by `app.name` so two apps holding presence on the same page path never
  // observe each other's join/leave traffic.
  const appId = app.name
  const snapshot = joinPresence({ appId, connectionId, pagePath, entry })

  return openPresenceStream({
    c,
    app,
    admitted,
    presence: { appId, connectionId, pagePath },
    snapshot,
    registration,
  })
}

/**
 * Open the presence SSE stream for a joined entry and bind it to the doors
 * that end it.
 */
function openPresenceStream(input: {
  readonly c: Context
  readonly app: App
  readonly admitted: {
    readonly match: DeclaredPageMatch
    readonly watched: readonly WatchedRecord[]
  }
  readonly presence: {
    readonly appId: string
    readonly connectionId: string
    readonly pagePath: string
  }
  readonly snapshot: ReturnType<typeof joinPresence>
  /** Her slot in the presence pool, taken before she joined. */
  readonly registration: Extract<ConnectionRegistration, { readonly accepted: true }>
}): Response {
  const { c, app, admitted, presence, snapshot, registration } = input
  const { appId, connectionId, pagePath } = presence
  // The queue is created EAGERLY, as the record subscription's is: it is the
  // buffer the presence listener writes to from the moment the request is
  // handled, and ending it is how the stream is ended from outside — by a
  // revocation door — without waiting for its lifetime.
  const queue = Effect.runSync(Queue.unbounded<Record<string, unknown>, Cause.Done>())
  const unsubscribePresence = addChannelListener(presenceChannel(appId, pagePath), (event) => {
    // eslint-disable-next-line functional/no-expression-statements -- synchronous push into the stream queue
    Queue.offerUnsafe(queue, event)
  })
  const end = (): void => {
    // eslint-disable-next-line functional/no-expression-statements -- ending the queue is what ends the stream
    Queue.endUnsafe(queue)
  }

  // The stream ends with the access it was opened on, through the doors that
  // end a record subscription: a change to her role, groups, assignments or a
  // ban (`closeUserConnections`) and the end of the session it was opened with
  // (`closeSessionConnections`). It holds a slot in her presence pool, never
  // one of her record subscriptions'. No re-check is bound: its lifetime (25 s) is shorter than the
  // re-check interval, so every reconnect already re-judges it. A write that
  // moves a watched record out of her reach ends it too.
  const unwatchRecords = watchRecordsForRevocation({
    c,
    app,
    match: admitted.match,
    watched: admitted.watched,
    end,
  })
  registration.bind({ close: end })

  return runEffectSse(c, Stream.fromQueue(queue), (event) => ({ kind: 'data', payload: event }), {
    preamble: [{ type: 'presence-sync', pagePath, users: snapshot }],
    onHeartbeat: () => touchPresence({ appId, connectionId, pagePath }),
    onTerminate: () => {
      unsubscribePresence()
      unwatchRecords()
      registration.release()
      leavePresence({ appId, connectionId, pagePath })
    },
  })
}
