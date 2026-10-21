/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Records API real-time subscription endpoint — served at both
 * `GET /api/tables/:tableId/subscribe/sse` and `GET /api/tables/:tableId/subscribe`.
 *
 * Drives `[internal ref]`
 * the subscription-filtering
 * specs in `subscription-filtering.spec.ts`
 * and the WebSocket-transport
 * specs in `real-time-mode-via-websocket.spec.ts`.
 *
 * The `/subscribe` path is the canonical handshake URL — clients open it with
 * optional `filter` / `fields` query params. The `/subscribe/sse` path is an
 * explicit-transport alias; both resolve to the same handler.
 *
 * Two transports share this endpoint:
 *
 *  - **WebSocket**: a request carrying the standard
 *    `Upgrade: websocket` handshake is upgraded (HTTP 101) and driven by
 *    the `websocket` handler from `hono/bun` (mounted in `server.ts`). The
 *    socket is registered as a channel-manager listener and receives live
 *    `insert`/`update`/`delete` change events, a 30s heartbeat ping, and
 *    answers a client `ping` with a `pong`.
 *  - **SSE**: a plain `GET` opens a Server-Sent Events stream,
 *    emits a `subscribed` confirmation, then streams `change` events as
 *    records are mutated. A periodic `heartbeat` keeps the connection alive;
 *    the stream closes after a bounded lifetime so `EventSource` clients
 *    reconnect cleanly and `fetch`-based callers are never left hanging.
 *
 * Both transports reuse the SAME channel-manager fan-out — a record CRUD
 * handler publishes a single change event and it reaches every open SSE
 * stream AND every open WebSocket on the table channel, where it is judged per
 * subscriber against their row-level read rule before anything is sent.
 *
 * Auth + table resolution are handled upstream by the `/api/tables/*`
 * middleware chain (`authMiddleware → requireAuth → validateTable →
 * enrichUserRole`): unauthenticated requests get HTTP 401 and unknown tables
 * get HTTP 404 before this handler ever runs.
 */

import { Effect, Queue, Stream, type Cause } from 'effect'
import { upgradeWebSocket } from 'hono/bun'
import { readerRowsOf } from '@/application/use-cases/tables/row-read-admission'
import { buildEffectiveRoles, getUserGroups } from '@/application/use-cases/tables/user-groups'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { REALTIME_TRANSPORT_CONFIG } from '@/domain/models/api/realtime/realtime'
import {
  buildReadAccessPlan,
  CANONICAL_READ_POLICY,
  narrowRequestedColumns,
  type ReadAccessPlan,
} from '@/domain/models/app/tables/read-access-plan-service'
import { grantFingerprint } from '@/domain/models/app/tables/realtime-grant-fingerprint-service'
import {
  scopeChangeToReader,
  withinAdmittedRows,
  type RowReadRule,
} from '@/domain/models/app/tables/realtime-row-scope-service'
import { relationshipFieldNames } from '@/domain/models/app/tables/record-id-service'
import { rowPassesRule } from '@/domain/models/app/tables/row-level-write-decision-service'
import { readStoredValues } from '@/domain/models/app/tables/stored-value-service'
import { logError } from '@/infrastructure/logging'
import { runDomainPromise } from '@/infrastructure/logging/request-effect'
import { tooManyRequestsResponse } from '@/infrastructure/process/rate-limit-response'
import { addChannelListener } from '@/infrastructure/realtime/channel-manager'
import {
  registerConnection,
  type ConnectionHooks,
  type RecheckSweep,
} from '@/infrastructure/realtime/connection-counter'
import { tableChannel } from '@/infrastructure/realtime/record-change-publisher'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import { runEffectSse } from '@/presentation/api/runtime/effect-sse'
import { SSE_RESPONSE_HEADERS, enqueueSseMessage } from '@/presentation/api/runtime/sse-stream'
import {
  resolveGuardForTable,
  type GuardCaller,
  type RowLevelGuardContext,
} from './row-level-guard'
import { parseSubscriptionFilter, changeEventMatchesFilter } from './subscription-filter'
import {
  applyFieldSelection,
  parseFieldSelection,
  readableChange,
  rowStreamColumnsOf,
  toWebSocketWireMessage,
  withStringRelationshipLinks,
  type RowStreamColumns,
} from './subscription-payload'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { App } from '@/domain/models/app'
import type { RowReadAdmission } from '@/domain/models/app/tables/row-read-admission-service'
import type { Table } from '@/domain/models/app/tables/table'
import type { Context } from 'hono'

// ---------------------------------------------------------------------------
// Field-permission resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the composed read plan for one subscription handshake, through the
 * canonical {@link buildReadAccessPlan} under {@link CANONICAL_READ_POLICY} —
 * the records list's own.
 *
 * The roles are the records API's: on a table with a row-level rule they are
 * the guard's (account role, groups AND `user_access` roles), so a caller the
 * records API admits through that overlay is admitted to the stream of the same
 * rows. They decide admission only — a field is matched against her own role
 * and groups, never a role she holds through a grant elsewhere — and a change
 * carries, row by row, the columns a list of that row returns her
 * (`rowStreamColumnsOf`). The rows are scoped per event by {@link readRuleOf}.
 */
const resolveReadPlan = (
  table: Table,
  caller: { readonly userRole: string; readonly effectiveRoles: readonly string[] },
  app: App,
  guard: RowLevelGuardContext | undefined
): ReadAccessPlan =>
  buildReadAccessPlan({
    app,
    table,
    principal: {
      role: caller.userRole,
      effectiveRoles: caller.effectiveRoles,
      isAuthenticated: true,
    },
    policy: CANONICAL_READ_POLICY,
    rowContext: guard?.current,
  })

/**
 * The subscriber's row-level read rule, as a pure in-memory predicate over a
 * changed row, held to the rows a list admits them — or `undefined` when no
 * rule governs them and they read every row. Resolved once per connection, so
 * each fanned-out change costs one predicate evaluation and no database read.
 */
const readRuleOf = (
  table: Table,
  { guard, rows }: Pick<SubscriptionGrant, 'guard' | 'rows'>
): RowReadRule | undefined => {
  const rlp = table.rowLevelPermissions
  const ruled =
    rlp?.read?.when !== undefined && guard !== undefined && !guard.current.isUnrestricted
  // Judged as the records API reads the row: a SQLite `1`/`0` boolean is
  // `true`/`false` before the rule sees it, whichever row the event carries.
  const rule: RowReadRule | undefined = ruled
    ? (row) => rowPassesRule(rlp, 'read', readStoredValues(table, row), guard.current)
    : undefined
  return withinAdmittedRows(rule, rows)
}

// ---------------------------------------------------------------------------
// Grant resolution — one path, shared by the handshake and the re-check
// ---------------------------------------------------------------------------

/** What one resolution of a subscriber's grant on a table decided. */
interface SubscriptionGrant {
  readonly guard: RowLevelGuardContext | undefined
  readonly plan: ReadAccessPlan
  /** The columns the stream may carry to this subscriber, row by row. */
  readonly columns: RowStreamColumns
  /** The rows a list of the table returns the subscriber (`readerRowsOf`). */
  readonly rows: RowReadAdmission
  /** The grant reduced to one comparable string — see `grantFingerprint`. */
  readonly fingerprint: string
}

/**
 * Resolve a subscriber's grant on one table: the records API's roles and row
 * context (on a row-rule table the guard adds the caller's `user_access` roles
 * and loads what the rule reads), then the read plan. The handshake and the
 * periodic re-check both resolve through here, so a connection is never judged
 * by a second path that could drift from the first.
 */
const resolveSubscriptionGrant = async (
  c: Context,
  session: Readonly<UserSession>,
  caller: GuardCaller,
  { table, app }: { readonly table: Table; readonly app: App }
): Promise<SubscriptionGrant> => {
  const guard = await resolveGuardForTable(c, session, caller, { table, app })
  const effectiveRoles =
    guard?.effectiveRoles ?? buildEffectiveRoles(caller.userRole, caller.userGroups)
  const admitted = resolveReadPlan(table, { userRole: caller.userRole, effectiveRoles }, app, guard)
  const reader = { role: caller.userRole, groups: caller.userGroups }
  const { admission: rows, grants } = await runDomainPromise(
    c,
    readerRowsOf(app, table.name, { ...reader, session })
  )
  const columns = rowStreamColumnsOf(app, table, reader, grants)
  // The handshake reports the columns her own role reads over the stream.
  const plan = { ...admitted, columnWhitelist: columns.own }
  const fingerprint = grantFingerprint({
    allowed: plan.allowed,
    columns: columns.own,
    rows,
    grants,
    rowContext: guard?.current,
  })
  return { guard, plan, columns, rows, fingerprint }
}

/**
 * The grant at the handshake, or `undefined` when it could not be read.
 *
 * A fault answers exactly as a denial does, and a denial answers exactly as a
 * missing table: a `500` that only an existing table can produce would tell the
 * caller the table exists, which the `404` is there to hide.
 */
const resolveHandshakeGrant = (
  c: Context,
  session: Readonly<UserSession>,
  caller: GuardCaller,
  { table, app }: { readonly table: Table; readonly app: App }
): Promise<SubscriptionGrant | undefined> =>
  resolveSubscriptionGrant(c, session, caller, { table, app }).catch(
    (cause: unknown): SubscriptionGrant | undefined => {
      // The refusal IS the answer — a grant that cannot be read is refused
      // exactly as a missing table is (see above), and the cause is logged on
      // the way past (E6).
      logError('[realtime] resolving a subscription grant failed; refusing it', cause, {
        table: table.name,
      })
      return undefined
    }
  )

/**
 * The caller's account role and groups, as the table middleware resolves them
 * for a request — on the services of the request that opened the connection.
 */
const resolveCaller = (c: Context, userId: string): Promise<GuardCaller> =>
  runDomainPromise(
    c,
    Effect.all({ userRole: getUserRole(userId), userGroups: getUserGroups(userId) })
  )

/**
 * The periodic re-check of one connection's grant: resolve it again from the
 * account up, and answer whether it is still the one the connection opened
 * with. The sweep memoises the caller per user and the grant per user and
 * table, so a user holding several connections to one table costs one
 * resolution per sweep, not one per connection.
 */
const recheckGrant =
  (input: {
    readonly c: Context
    readonly session: Readonly<UserSession>
    readonly table: Table
    readonly app: App
    readonly fingerprint: string
  }) =>
  async (sweep: RecheckSweep): Promise<boolean> => {
    const { c, session, table, app, fingerprint } = input
    const caller = await sweep.memo(`caller:${session.userId}`, () =>
      resolveCaller(c, session.userId)
    )
    const grant = await sweep.memo(`grant:${session.userId}:${table.name}`, () =>
      resolveSubscriptionGrant(c, session, caller, { table, app })
    )
    return grant.fingerprint === fingerprint
  }

/**
 * Anti-enumeration (S1): a table the caller may not subscribe to answers
 * exactly as a table that does not exist — the same `404` and the same body as
 * `validateTable`'s.
 */
const notFoundResponse = (c: Context): Response => notFound(c)

// ---------------------------------------------------------------------------
// SSE transport
// ---------------------------------------------------------------------------

/** Scoping parameters resolved from a subscription handshake. */
interface SubscriptionScope {
  /** The columns the stream may carry to this subscriber, row by row. */
  readonly columns: RowStreamColumns
  /** The subscriber's own `?fields=` selection, applied within {@link columns}. */
  readonly fields: readonly string[] | undefined
  readonly filter: ReturnType<typeof parseSubscriptionFilter>
  /** The subscriber's row-level read rule; `undefined` when none governs them. */
  readonly reads: RowReadRule | undefined
  /** The table's relationship fields, whose values are sent as strings. */
  readonly links: readonly string[]
}

const enqueue = enqueueSseMessage

/**
 * Buffered handshake stream for `fetch`/Playwright `request.get` callers
 * (a wildcard `Accept` header): emits the `subscribed` + `heartbeat`
 * confirmation and closes immediately so the caller is never left blocked.
 */
const buildHandshakeStream = (tableName: string): ReadableStream<Uint8Array> =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      enqueue(controller, { type: 'subscribed', table: tableName })
      enqueue(controller, { type: 'heartbeat', timestamp: new Date().toISOString() })
      controller.close()
    },
  })

/**
 * Live SSE response for browser `EventSource` clients.
 *
 * Emits the `subscribed` + initial `heartbeat` handshake (preamble), then
 * streams server-side-filtered `change` events plus keep-alive heartbeats
 * until the bounded lifetime elapses (after which the client auto-reconnects).
 * Lifecycle (heartbeat ticker, lifetime ceiling, abort observability) is
 * owned by the shared `runEffectSse` bridge; this function only owns the
 * subscription-scoping (filter + field-selection) of the source stream.
 */
const buildLiveResponse = (params: {
  readonly c: Context
  readonly appId: string
  readonly tableName: string
  readonly scope: SubscriptionScope
  /**
   * Released on stream teardown (bounded-lifetime timeout OR client abort)
   * so the per-user connection counter does not leak. The counter's
   * `release` is idempotent so double-fire is safe; the bridge fires
   * `onTerminate` exactly once per connection regardless of reason.
   */
  readonly release: () => void
  /** Hands the registry how this stream is ended when the subscriber's grant changes. */
  readonly bind: (hooks: ConnectionHooks) => void
}): Response => {
  const { c, appId, tableName, scope, release, bind } = params

  // REGISTRATION HAPPENS HERE, not inside the stream — that placement is the
  // whole point of this function's shape. `runEffectSse` sequences preamble →
  // heartbeat → drain, and Hono's `streamSSE` commits the HTTP 200 at or before
  // the preamble write; `EventSource` fires `onopen` on that 200, so the client
  // can issue a write before a drain-time listener exists. `channel-manager`
  // has neither buffer nor replay, so such a change was dropped silently —
  // measured: one connection in three lost its first write that way.
  // Registering before `runEffectSse` closes the window by construction: the
  // listener exists before any byte, status line included, reaches the client.
  // The queue is created EAGERLY and IS the buffer (`Stream.callback` handed its
  // queue out only once drained, which is what made registration late); an
  // unbounded queue is both the holding buffer and the replay, and
  // `Stream.fromQueue` later drains whatever accumulated.
  const queue = Effect.runSync(Queue.unbounded<Record<string, unknown>, Cause.Done>())

  const unsubscribe = addChannelListener(tableChannel(appId, tableName), (event) => {
    // Row scope first, on the unfiltered row: the rule may read a column the
    // subscriber's field whitelist later strips.
    const scoped = scopeChangeToReader(event, scope.reads)
    if (scoped === undefined) return
    // The `?filter=` is judged on the columns the subscriber may read, never on
    // one stripped from them: a filter on a hidden column would otherwise say,
    // event by event, what that column holds. Their own `?fields=` selection
    // narrows the payload only after, so a filter on a readable column they
    // did not select still works.
    const readable = readableChange(scope.columns, scoped)
    if (!changeEventMatchesFilter(readable, scope.filter)) return
    Queue.offerUnsafe(
      queue,
      withStringRelationshipLinks(applyFieldSelection(readable, scope.fields), scope.links)
    )
  })

  const source = Stream.fromQueue(queue)

  // A grant change, or the end of the stream's session, ends the stream:
  // ending the queue completes the drain, the bridge tears the connection down
  // through `onTerminate`, and `EventSource` reconnects on its own — to a
  // handshake that judges the grant and the session as they stand now (a dead
  // session is refused with 401 by the auth middleware). No re-check is bound: the stream's own lifetime
  // (`SSE_STREAM_MAX_LIFETIME_MS`, 25 s) is shorter than the re-check interval,
  // so every reconnect already re-judges it.
  bind({
    close: () => {
      unsubscribe()
      Queue.endUnsafe(queue)
    },
  })

  return runEffectSse(c, source, (event) => ({ kind: 'data', payload: event }), {
    preamble: [
      { type: 'subscribed', table: tableName },
      { type: 'heartbeat', timestamp: new Date().toISOString() },
    ],
    onTerminate: () => {
      // Teardown moved here from an `Effect.addFinalizer` inside the stream,
      // and had to: an eagerly-registered listener outlives the stream's
      // scope, so a connection aborted before the first drain tick would
      // never have run that finalizer and would have leaked its listener for
      // the life of the process. `onTerminate` fires exactly once per
      // connection whatever the reason — clean end, lifetime ceiling, or
      // client abort — which is the only hook with that property.
      unsubscribe()
      release()
    },
  })
}

// ---------------------------------------------------------------------------
// WebSocket transport
// ---------------------------------------------------------------------------

/**
 * Detect a WebSocket upgrade handshake. A browser `WebSocket` client sends
 * `Upgrade: websocket`; a plain `fetch`/SSE caller does not.
 */
const isWebSocketUpgrade = (c: Context): boolean =>
  (c.req.header('upgrade') ?? '').toLowerCase() === 'websocket'

/** The minimal `send`/`close` surface of a Hono WebSocket context. */
interface SendableWebSocket {
  readonly send: (data: string) => unknown
  readonly close: (code?: number, reason?: string) => void
}

/** Per-connection teardown handle held across the WebSocket lifetime. */
interface WebSocketConnectionState {
  unsubscribe?: () => void
  heartbeat?: ReturnType<typeof setInterval>
}

/**
 * Serialise and send a realtime message over a WebSocket. A send on an
 * already-closed socket is swallowed — `onClose` runs the teardown path.
 */
const sendWebSocketMessage = (ws: SendableWebSocket, msg: Record<string, unknown>): void => {
  try {
    ws.send(JSON.stringify(msg))
  } catch {
    // Connection already torn down.
  }
}

/**
 * Build the per-connection event callbacks for one upgraded WebSocket.
 *
 * The socket is registered as a channel-manager listener (the SAME fan-out
 * the SSE transport uses) so it receives live `insert`/`update`/`delete`
 * change events. A `subscribed` confirmation is sent on open, a 30s heartbeat
 * ping keeps the connection alive, a client `ping` is answered with a `pong`,
 * and the channel listener + heartbeat timer are torn down on close.
 */
const buildWebSocketEvents = (params: {
  readonly appId: string
  readonly tableName: string
  readonly columns: RowStreamColumns
  readonly fields: readonly string[] | undefined
  readonly reads: RowReadRule | undefined
  readonly links: readonly string[]
  /** Released on `onClose` so the per-user connection counter does not leak. */
  readonly release: () => void
  /** Hands the registry how this socket is closed and re-checked. */
  readonly bind: (hooks: ConnectionHooks) => void
  /** Resolves the grant again and answers whether it still matches. */
  readonly recheck: NonNullable<ConnectionHooks['recheck']>
}) => {
  const { appId, tableName, columns, fields, reads, links, release, bind, recheck } = params
  const state: WebSocketConnectionState = {}

  return {
    onOpen(_event: Event, ws: SendableWebSocket): void {
      sendWebSocketMessage(ws, { type: 'subscribed', table: tableName })

      state.unsubscribe = addChannelListener(tableChannel(appId, tableName), (event) => {
        const scoped = scopeChangeToReader(event, reads)
        if (scoped === undefined) return
        const wire = toWebSocketWireMessage(readableChange(columns, scoped), fields)
        sendWebSocketMessage(ws, withStringRelationshipLinks(wire, links))
      })

      state.heartbeat = setInterval(() => {
        sendWebSocketMessage(ws, { type: 'heartbeat', timestamp: new Date().toISOString() })
      }, REALTIME_TRANSPORT_CONFIG.heartbeatIntervalMs)

      // A grant change or the end of the socket's session — at once from an
      // in-process door, or at the next re-check for one made elsewhere —
      // closes the socket with the code the registry hands over (grant-changed:
      // reconnect; session-ended: sign in again). The listener goes first so
      // nothing more is sent; `onClose` still runs the rest of the teardown.
      bind({
        close: (cause) => {
          if (state.unsubscribe) state.unsubscribe()
          try {
            ws.close(cause.code, cause.reason)
          } catch {
            // Already closing — `onClose` runs the teardown path.
          }
        },
        recheck,
      })
    },
    onMessage(event: { data: unknown }, ws: SendableWebSocket): void {
      // A client-sent `ping` keep-alive is answered with a `pong`.
      const text = typeof event.data === 'string' ? event.data : ''
      if (text.includes('ping')) {
        sendWebSocketMessage(ws, { type: 'pong', timestamp: new Date().toISOString() })
      }
    },
    onClose(): void {
      if (state.unsubscribe) state.unsubscribe()
      if (state.heartbeat) clearInterval(state.heartbeat)
      release()
    },
  }
}

/**
 * Upgrade the request to a WebSocket connection driven by the per-connection
 * event callbacks built by {@link buildWebSocketEvents}.
 */
const handleWebSocketUpgrade = (params: {
  readonly c: Context
  readonly appId: string
  readonly tableName: string
  readonly columns: RowStreamColumns
  readonly fields: readonly string[] | undefined
  readonly reads: RowReadRule | undefined
  readonly links: readonly string[]
  readonly release: () => void
  readonly bind: (hooks: ConnectionHooks) => void
  readonly recheck: NonNullable<ConnectionHooks['recheck']>
}): Promise<Response> => {
  const { c, ...events } = params
  const middleware = upgradeWebSocket(() => buildWebSocketEvents(events))

  // `upgradeWebSocket` is a Hono middleware: invoke it directly with a no-op
  // `next` so it runs `server.upgrade()` and returns the 101 handshake.
  return Promise.resolve(middleware(c, async () => undefined)).then(
    (res) => res ?? new Response(undefined, { status: 426 })
  )
}

// ---------------------------------------------------------------------------
// Endpoint handler
// ---------------------------------------------------------------------------

/**
 * Handle `GET /api/tables/:tableId/subscribe/sse` and `/subscribe`.
 *
 * When the request carries a WebSocket upgrade handshake the connection is
 * upgraded (HTTP 101) and driven by the WebSocket transport. Otherwise an SSE
 * stream is opened confirming the subscription, then streaming live `change`
 * events for the bound table until the connection closes or the bounded
 * lifetime elapses.
 */
/**
 * Build the response headers that echo the requested filter/fields scoping
 * back to the client. Used by both the live SSE stream
 * and the handshake-only stream so the wire format stays uniform.
 */
const buildSubscriptionHeaders = (
  filterExpr: string | undefined,
  fields: readonly string[] | undefined
): Record<string, string> => ({
  ...SSE_RESPONSE_HEADERS,
  ...(filterExpr !== undefined ? { 'X-Subscription-Filter': filterExpr } : {}),
  ...(fields !== undefined ? { 'X-Subscription-Fields': fields.join(',') } : {}),
})

/**
 * Construct the 429 "Too Many Connections" response.
 *
 * Shares the envelope with the rate limiters but not their reason: the caller
 * is not sending too fast, it is holding too many open streams, so the message
 * names the cap and the retry hint is a flat 30 s rather than the time until a
 * sliding window frees a slot.
 */
export const tooManyConnectionsResponse = (c: Context, current: number, limit: number): Response =>
  tooManyRequestsResponse(c, {
    message: `Concurrent connection limit reached (${current}/${limit}). Close an existing connection and retry.`,
    code: 'TOO_MANY_CONNECTIONS',
    retryAfterSeconds: 30,
  })

interface LiveTransportInput {
  readonly c: Context
  readonly app: App
  /** The handshake's session: its user, and its own id, which bounds the connection. */
  readonly session: Readonly<UserSession>
  readonly table: Table
  readonly grant: SubscriptionGrant
}

/**
 * Open a live realtime transport (WebSocket or SSE) under the per-user
 * connection cap. Returns 429 + Retry-After when the user is already at
 * cap; otherwise upgrades to WS or opens an SSE stream that releases the
 * connection slot on teardown.
 *
 * BOTH transports now scope their payloads by the SERVER-resolved column
 * whitelist. They did not: the WebSocket branch forwarded `readableFields`
 * while the SSE branch substituted the client's own `?fields=` parameter for
 * it, so an SSE subscriber who simply omitted the parameter received every
 * column of every insert and update — including the `oldRecord` previous
 * values — and the `X-Subscription-Fields` response header echoed the caller's
 * own request back, which made the omission look enforced.
 *
 * A client `?fields=` selection can only ever NARROW the whitelist
 * ({@link narrowRequestedColumns}); the echoed header now reports the
 * EFFECTIVE selection, not the requested one.
 */
const openLiveTransport = (input: LiveTransportInput): Promise<Response> => {
  const { c, app, session, table, grant } = input
  const { plan } = grant
  const tableName = table.name
  const reads = readRuleOf(table, grant)
  const links = relationshipFieldNames(table)
  const registration = registerConnection(session.userId, session.id)
  if (!registration.accepted) {
    return Promise.resolve(tooManyConnectionsResponse(c, registration.current, registration.limit))
  }
  const requested = parseFieldSelection(c.req.query('fields'))
  const effectiveFields = narrowRequestedColumns(plan, requested)
  const { columns } = grant
  if (isWebSocketUpgrade(c)) {
    return handleWebSocketUpgrade({
      c,
      appId: app.name,
      tableName,
      columns,
      fields: requested,
      reads,
      links,
      release: registration.release,
      bind: registration.bind,
      recheck: recheckGrant({ c, session, table, app, fingerprint: grant.fingerprint }),
    })
  }
  const filterExpr = c.req.query('filter')
  const filter = parseSubscriptionFilter(filterExpr)
  // Echo the EFFECTIVE scoping back so clients can confirm what the server
  // honoured. Hono's `c.header(...)` sets headers that streamSSE carries into
  // its 200 response without us having to construct the Response by hand.
  if (filterExpr !== undefined) c.header('X-Subscription-Filter', filterExpr)
  if (effectiveFields !== undefined) c.header('X-Subscription-Fields', effectiveFields.join(','))
  return Promise.resolve(
    buildLiveResponse({
      c,
      appId: app.name,
      tableName,
      scope: { columns, fields: requested, filter, reads, links },
      release: registration.release,
      bind: registration.bind,
    })
  )
}

export async function handleSubscribe(c: Context, app: App): Promise<Response> {
  const { session, tableName, userRole, userGroups } = getTableContext(c)

  const table = app.tables?.find((t) => t.name === tableName)
  // validateTable already guarantees the table exists; this is a defensive
  // narrow so the permission check below has a concrete table.
  if (!table) return notFoundResponse(c)

  // Anti-enumeration: a denied subscription — one whose grant could not be read,
  // or that admits no row — is indistinguishable from a missing table (S1 — 404).
  const grant = await resolveHandshakeGrant(c, session, { userRole, userGroups }, { table, app })
  if (grant?.plan.allowed !== true || grant.rows.kind === 'no-row') return notFoundResponse(c)
  const { plan } = grant

  // Enforce the per-user concurrent transport-connection
  // cap. The handshake-only stream (`fetch` / Playwright `request.get`) does
  // not register because the response closes before the helper returns —
  // counting it would over-report. Live SSE and WebSocket transports DO
  // register and release on teardown.
  const acceptsEventStream = (c.req.header('accept') ?? '').includes('text/event-stream')
  if (isWebSocketUpgrade(c) || acceptsEventStream) {
    return openLiveTransport({ c, app, session, table, grant })
  }

  // Buffered `fetch`/Playwright (Accept: */*) caller — handshake-only stream
  // that closes immediately. Echo the requested scoping headers so callers
  // can confirm the server honoured their filter/fields handshake.
  const fields = narrowRequestedColumns(plan, parseFieldSelection(c.req.query('fields')))
  const filterExpr = c.req.query('filter')
  return new Response(buildHandshakeStream(tableName), {
    status: 200,
    headers: buildSubscriptionHeaders(filterExpr, fields),
  })
}
