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
 *, the subscription-filtering
 * specs in `subscription-filtering.spec.ts`
 *, and the WebSocket-transport
 * specs in `real-time-mode-via-websocket.spec.ts`
 *.
 *
 * The `/subscribe` path is the canonical handshake URL — clients open it with
 * optional `filter` / `fields` query params. The `/subscribe/sse` path is an
 * explicit-transport alias; both resolve to the same handler.
 *
 * Two transports share this endpoint:
 *
 * - **WebSocket**: a request carrying the standard
 *    `Upgrade: websocket` handshake is upgraded (HTTP 101) and driven by
 *    the `websocket` handler from `hono/bun` (mounted in `server.ts`). The
 *    socket is registered as a channel-manager listener and receives live
 *    `insert`/`update`/`delete` change events, a 30s heartbeat ping, and
 *    answers a client `ping` with a `pong`.
 * - **SSE**: a plain `GET` opens a Server-Sent Events stream,
 *    emits a `subscribed` confirmation, then streams `change` events as
 *    records are mutated. A periodic `heartbeat` keeps the connection alive;
 *    the stream closes after a bounded lifetime so `EventSource` clients
 *    reconnect cleanly and `fetch`-based callers are never left hanging.
 *
 * Both transports reuse the SAME channel-manager fan-out — a record CRUD
 * handler publishes a single change event and it is delivered over every
 * open SSE stream AND every open WebSocket on the table channel.
 *
 * Auth + table resolution are handled upstream by the `/api/tables/*`
 * middleware chain (`authMiddleware → requireAuth → validateTable →
 * enrichUserRole`): unauthenticated requests get HTTP 401 and unknown tables
 * get HTTP 404 before this handler ever runs.
 */

import { Effect, Queue, Stream } from 'effect'
import { upgradeWebSocket } from 'hono/bun'
import { buildEffectiveRoles } from '@/application/use-cases/tables/user-groups'
import { REALTIME_TRANSPORT_CONFIG } from '@/domain/models/api/realtime/realtime'
import {
  buildReadAccessPlan,
  narrowRequestedColumns,
  REALTIME_READ_POLICY,
  type ReadAccessPlan,
} from '@/domain/models/app/tables/read-access-plan-service'
import { tooManyRequestsResponse } from '@/infrastructure/process/rate-limit-response'
import { addChannelListener } from '@/infrastructure/realtime/channel-manager'
import { registerConnection } from '@/infrastructure/realtime/connection-counter'
import { tableChannel } from '@/infrastructure/realtime/record-change-publisher'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import { runEffectSse } from '@/presentation/api/runtime/effect-sse'
import { SSE_RESPONSE_HEADERS, enqueueSseMessage } from '@/presentation/api/runtime/sse-stream'
import { parseSubscriptionFilter, changeEventMatchesFilter } from './subscription-filter'
import type { App } from '@/domain/models/app'
import type { Table } from '@/domain/models/app/tables/table'
import type { Context } from 'hono'

// ---------------------------------------------------------------------------
// Field-permission resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the composed read plan for one subscription handshake.
 *
 * Delegates to the canonical {@link buildReadAccessPlan} under
 * {@link REALTIME_READ_POLICY}, which differs from the REST record read in
 * exactly one NAMED way: a field grant is matched against ANY of the caller's
 * effective roles rather than the primary one. That breadth is deliberate — the
 * whitelist is resolved once per CONNECTION and then applied to every fanned-out
 * change event — and it is now a policy value rather than a local re-derivation.
 *
 * Two things the hand-rolled predecessor got wrong and the plan fixes:
 *
 *  - it skipped the BUILT-IN DEFAULT FIELD RULES entirely, so a `viewer` saw
 *    columns over the stream that `GET /records` strips (a stream and a `GET`
 *    on the same table must not disagree about which columns exist);
 *  - it short-circuited to "no filtering" whenever the table declared no
 *    `permissions.fields`, which is precisely when the default rules apply.
 *
 * No row-level context is supplied: this endpoint gates the SUBSCRIPTION, and
 * per-row scoping of fanned-out change events is a separate, unimplemented
 * concern (see the report accompanying this change). `rowPredicate` is therefore
 * `'unresolved'` on a table with `rowLevelPermissions` and MUST NOT be read as
 * "no constraint".
 */
const resolveReadPlan = (
  table: Table,
  effectiveRoles: readonly string[],
  userRole: string,
  app: App
): ReadAccessPlan =>
  buildReadAccessPlan({
    app,
    table,
    principal: { role: userRole, effectiveRoles, isAuthenticated: true },
    policy: REALTIME_READ_POLICY,
  })

// ---------------------------------------------------------------------------
// Change-event payload shaping
// ---------------------------------------------------------------------------

/**
 * Apply a column whitelist to a single record payload. `id` is always
 * retained. Returns the payload unchanged when no whitelist was supplied.
 */
const pickRecordFields = (
  payload: unknown,
  whitelist: ReadonlySet<string> | undefined
): unknown => {
  if (!whitelist) return payload
  if (payload === null || typeof payload !== 'object') return payload
  const { id, fields: recordFields } = payload as {
    id?: unknown
    fields?: Record<string, unknown>
  }
  if (recordFields === undefined) return payload
  const filtered = Object.fromEntries(
    Object.entries(recordFields).filter(([key]) => whitelist.has(key))
  )
  return { id, fields: filtered }
}

/**
 * Apply a `fields` whitelist to a change event's record/oldRecord payloads.
 * `id` is always retained. Returns the event unchanged when no whitelist was
 * requested.
 */
const applyFieldSelection = (
  event: Record<string, unknown>,
  fields: readonly string[] | undefined
): Record<string, unknown> => {
  if (!fields) return event
  const whitelist = new Set(fields)
  return {
    ...event,
    ...(event['record'] !== undefined
      ? { record: pickRecordFields(event['record'], whitelist) }
      : {}),
    ...(event['oldRecord'] !== undefined
      ? { oldRecord: pickRecordFields(event['oldRecord'], whitelist) }
      : {}),
  }
}

/**
 * Shape a raw channel event into the wire message for a WebSocket subscriber.
 *
 * `delete` events are reduced to `{ type: 'delete', recordId, table }`.
 * `insert` / `update` events carry the field-permission-filtered record (and
 * previous values, for updates) under the canonical change-event shape.
 */
const toWebSocketWireMessage = (
  event: Record<string, unknown>,
  readableFields: readonly string[] | undefined
): Record<string, unknown> => {
  if (event['event'] === 'delete') {
    return { type: 'delete', recordId: event['recordId'], table: event['table'] }
  }
  return applyFieldSelection(event, readableFields)
}

// ---------------------------------------------------------------------------
// SSE transport
// ---------------------------------------------------------------------------

/** Scoping parameters resolved from a subscription handshake. */
interface SubscriptionScope {
  readonly fields: readonly string[] | undefined
  readonly filter: ReturnType<typeof parseSubscriptionFilter>
}

const enqueue = enqueueSseMessage

/**
 * Parse the optional comma-separated `fields` query param into a field list.
 * Returns `undefined` when no field selection was requested.
 */
const parseFieldSelection = (raw: string | undefined): readonly string[] | undefined => {
  if (raw === undefined || raw.trim() === '') return undefined
  const fields = raw
    .split(',')
    .map((field) => field.trim())
    .filter((field) => field.length > 0)
  return fields.length > 0 ? fields : undefined
}

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
}): Response => {
  const { c, appId, tableName, scope, release } = params

  // REGISTRATION HAPPENS HERE, not inside the stream — and that placement is
  // the whole point of this function's shape.
  //
  // `runEffectSse` sequences preamble → heartbeat → drain, and Hono's
  // `streamSSE` commits the HTTP 200 at or before the preamble write. A
  // browser's `EventSource` fires `onopen` on that 200, so the client can
  // observe itself as connected — and issue a write — while the drain that
  // would have registered this listener has not run yet. Registering inside
  // `Stream.callback` therefore left a window in which a change published to
  // the channel reached NO listener, and `channel-manager` has neither a
  // buffer nor a replay, so such a change was dropped silently and
  // permanently. Measured: roughly one connection in three lost its first
  // write that way.
  //
  // Registering before `runEffectSse` is called closes the window by
  // construction rather than narrowing it: the listener exists before the
  // response object is built, so before any byte — 200 status line included —
  // can reach the client.
  // The queue is created EAGERLY and IS the buffer. `Stream.callback` — the
  // Effect 4 shape this replaced — hands its queue out only once the stream is
  // drained, which is precisely what made registration late. Hoisting the
  // queue out inverts that: the listener has somewhere to put an event from
  // the moment the request is handled, and `Stream.fromQueue` later drains
  // whatever accumulated. No hand-rolled holding buffer and no replay step,
  // because an unbounded queue already is both.
  const queue = Effect.runSync(Queue.unbounded<Record<string, unknown>>())

  const unsubscribe = addChannelListener(tableChannel(appId, tableName), (event) => {
    if (!changeEventMatchesFilter(event, scope.filter)) return
    // eslint-disable-next-line functional/no-expression-statements -- synchronous push into the stream queue, as the listener contract requires
    Queue.offerUnsafe(queue, applyFieldSelection(event, scope.fields))
  })

  const source = Stream.fromQueue(queue)

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

/** The minimal `send`-capable surface of a Hono WebSocket context. */
interface SendableWebSocket {
  readonly send: (data: string) => unknown
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
    // eslint-disable-next-line functional/no-expression-statements -- WebSocket send is an effect
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
  readonly readableFields: readonly string[] | undefined
  /** Released on `onClose` so the per-user connection counter does not leak. */
  readonly release: () => void
}) => {
  const { appId, tableName, readableFields, release } = params
  /* eslint-disable functional/immutable-data, functional/no-expression-statements -- per-connection teardown state mutated once on open */
  const state: WebSocketConnectionState = {}

  return {
    onOpen(_event: Event, ws: SendableWebSocket): void {
      sendWebSocketMessage(ws, { type: 'subscribed', table: tableName })

      state.unsubscribe = addChannelListener(tableChannel(appId, tableName), (event) => {
        sendWebSocketMessage(ws, toWebSocketWireMessage(event, readableFields))
      })

      state.heartbeat = setInterval(() => {
        sendWebSocketMessage(ws, { type: 'heartbeat', timestamp: new Date().toISOString() })
      }, REALTIME_TRANSPORT_CONFIG.heartbeatIntervalMs)
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
  /* eslint-enable functional/immutable-data, functional/no-expression-statements */
}

/**
 * Upgrade the request to a WebSocket connection driven by the per-connection
 * event callbacks built by {@link buildWebSocketEvents}.
 */
const handleWebSocketUpgrade = (params: {
  readonly c: Context
  readonly appId: string
  readonly tableName: string
  readonly readableFields: readonly string[] | undefined
  readonly release: () => void
}): Promise<Response> => {
  const { c, appId, tableName, readableFields, release } = params
  const middleware = upgradeWebSocket(() =>
    buildWebSocketEvents({ appId, tableName, readableFields, release })
  )

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
const tooManyConnectionsResponse = (c: Context, current: number, limit: number): Response =>
  tooManyRequestsResponse(c, {
    message: `Concurrent connection limit reached (${current}/${limit}). Close an existing connection and retry.`,
    code: 'TOO_MANY_CONNECTIONS',
    retryAfterSeconds: 30,
  })

interface LiveTransportInput {
  readonly c: Context
  readonly app: App
  readonly session: { readonly userId: string }
  readonly tableName: string
  readonly plan: ReadAccessPlan
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
  const { c, app, session, tableName, plan } = input
  const registration = registerConnection(session.userId)
  if (!registration.accepted) {
    return Promise.resolve(tooManyConnectionsResponse(c, registration.current, registration.limit))
  }
  const requested = parseFieldSelection(c.req.query('fields'))
  const effectiveFields = narrowRequestedColumns(plan, requested)
  if (isWebSocketUpgrade(c)) {
    return handleWebSocketUpgrade({
      c,
      appId: app.name,
      tableName,
      readableFields: effectiveFields,
      release: registration.release,
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
      scope: { fields: effectiveFields, filter },
      release: registration.release,
    })
  )
}

export async function handleSubscribe(c: Context, app: App): Promise<Response> {
  const { session, tableName, userRole, userGroups } = getTableContext(c)

  const table = app.tables?.find((t) => t.name === tableName)
  // validateTable already guarantees the table exists; this is a defensive
  // narrow so the permission check below has a concrete table.
  if (!table) {
    return c.json({ success: false, message: 'Table not found', code: 'NOT_FOUND' }, 404)
  }

  const effectiveRoles = buildEffectiveRoles(userRole, userGroups)
  const plan = resolveReadPlan(table, effectiveRoles, userRole, app)
  if (!plan.allowed) {
    // Anti-enumeration: a denied subscription is indistinguishable from a
    // missing table (S1 — return 404, never 403).
    return c.json({ success: false, message: 'Table not found', code: 'NOT_FOUND' }, 404)
  }

  // [internal ref]: enforce the per-user concurrent transport-connection
  // cap. The handshake-only stream (`fetch` / Playwright `request.get`) does
  // not register because the response closes before the helper returns —
  // counting it would over-report. Live SSE and WebSocket transports DO
  // register and release on teardown.
  const acceptsEventStream = (c.req.header('accept') ?? '').includes('text/event-stream')
  if (isWebSocketUpgrade(c) || acceptsEventStream) {
    return openLiveTransport({ c, app, session, tableName, plan })
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
