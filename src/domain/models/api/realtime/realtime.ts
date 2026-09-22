/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { looseIsoDateTime, uri } from '@/domain/models/api/combinators/formats'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

// ---------------------------------------------------------------------------
// Realtime record payload
// ---------------------------------------------------------------------------

/**
 * Schema for the record payload carried inside `change` events.
 *
 * Mirrors the canonical Records API response envelope (`{ id, fields }`) so
 * a `change` event can be applied to a data-bound component's cache without
 * any shape translation. The `fields` map is already field-permission
 * filtered server-side before the event is broadcast — a subscriber only
 * ever receives the columns its role can read.
 */
export const realtimeRecordPayloadSchema = Schema.Struct({
  id: Schema.Union([Schema.String, Schema.Finite]).annotate({
    description: 'Identifier of the record',
  }),
  fields: Schema.Record(Schema.String, Schema.Unknown).annotate({
    description: 'Field-permission-filtered record field values',
  }),
})

// ---------------------------------------------------------------------------
// Realtime change event schema
// ---------------------------------------------------------------------------

/**
 * Schema for a record change event pushed to subscribed clients.
 *
 * Emitted for `insert`, `update`, and `delete` mutations on a subscribed
 * table. `insert`/`update` events carry the full (permission-filtered)
 * record under `record`; `update` events also carry the previous values
 * under `oldRecord` so a filtered subscription can detect filter
 * enter/exit transitions. `delete` events carry only `recordId`.
 *
 * The `subscriptionId` echoes the client-supplied handshake id so a single
 * transport connection can multiplex several table subscriptions.
 */
export const realtimeChangeEventSchema = Schema.Struct({
  type: Schema.Literal('change').annotate({ description: 'Event type identifier' }),
  event: Schema.Literals(['insert', 'update', 'delete']).annotate({
    description: 'Kind of record mutation',
  }),
  table: Schema.String.annotate({ description: 'Table where the change occurred' }),
  recordId: Schema.Union([Schema.String, Schema.Finite]).annotate({
    description: 'Identifier of the affected record',
  }),
  subscriptionId: optionalField(
    Schema.String.annotate({
      description: 'Client handshake id this event belongs to (multiplexing)',
    })
  ),
  record: optionalField(
    realtimeRecordPayloadSchema.annotate({
      description: 'Full record payload (present for insert and update events)',
    })
  ),
  oldRecord: optionalField(
    realtimeRecordPayloadSchema.annotate({
      description: 'Previous record payload (present for update events only)',
    })
  ),
  timestamp: looseIsoDateTime({ description: 'ISO 8601 timestamp of the change' }),
})

// ---------------------------------------------------------------------------
// Realtime conflict event schema
// ---------------------------------------------------------------------------

/**
 * Schema for a conflict event raised when a concurrent edit overwrites a
 * field the current user had a pending optimistic change for.
 *
 * Drives the conflict toast: the client renders an
 * `alert` listing the overwritten field name(s) and the display name of the
 * user whose write won. The authoritative server values are carried so the
 * client can reconcile (server-wins) in the same payload.
 */
export const realtimeConflictEventSchema = Schema.Struct({
  type: Schema.Literal('conflict').annotate({ description: 'Event type identifier' }),
  table: Schema.String.annotate({ description: 'Table where the conflict occurred' }),
  recordId: Schema.Union([Schema.String, Schema.Finite]).annotate({
    description: 'Identifier of the contested record',
  }),
  overwrittenFields: Schema.Array(Schema.String)
    .annotate({ description: 'Field name(s) whose pending optimistic value was overwritten' })
    .pipe(Schema.check(Schema.isMinLength(1))),
  overwrittenBy: Schema.Struct({
    id: Schema.String.annotate({ description: 'User id of the writer whose change won' }),
    name: Schema.String.annotate({ description: 'Display name of the writer whose change won' }),
  }).annotate({ description: 'The user whose concurrent write overwrote the pending change' }),
  authoritativeRecord: realtimeRecordPayloadSchema.annotate({
    description: 'Server-authoritative record state the client must reconcile to',
  }),
  timestamp: looseIsoDateTime({ description: 'ISO 8601 timestamp of the conflict' }),
})

// ---------------------------------------------------------------------------
// Realtime heartbeat schema
// ---------------------------------------------------------------------------

/**
 * Schema for keep-alive heartbeat messages.
 *
 * The server emits a heartbeat on every active transport connection every
 * `HEARTBEAT_INTERVAL_MS` (see {@link webSocketTransportConfigSchema}) so
 * idle connections are not reaped by intermediary proxies and the client
 * can detect a silently-dropped connection.
 */
export const realtimeHeartbeatSchema = Schema.Struct({
  type: Schema.Literal('heartbeat').annotate({ description: 'Event type identifier' }),
  timestamp: looseIsoDateTime({ description: 'ISO 8601 timestamp of the heartbeat' }),
})

// ---------------------------------------------------------------------------
// Realtime subscription status schemas
// ---------------------------------------------------------------------------

/**
 * Schema for subscription confirmation messages.
 *
 * Sent once immediately after a successful handshake. Echoes back the
 * `subscriptionId` and the resolved `filter`/`fields` scoping so the client
 * can confirm the server honoured its handshake parameters.
 */
export const realtimeSubscribedSchema = Schema.Struct({
  type: Schema.Literal('subscribed').annotate({ description: 'Event type identifier' }),
  table: Schema.String.annotate({ description: 'Table that was subscribed to' }),
  subscriptionId: optionalField(
    Schema.String.annotate({ description: 'Client handshake id for this subscription' })
  ),
  filter: optionalField(
    Schema.String.annotate({
      description: 'Resolved filter expression applied server-side to change events',
    })
  ),
  fields: optionalField(
    Schema.Array(Schema.String).annotate({
      description: 'Resolved field whitelist applied server-side to change events',
    })
  ),
})

/**
 * Schema for unsubscription confirmation messages.
 */
export const realtimeUnsubscribedSchema = Schema.Struct({
  type: Schema.Literal('unsubscribed').annotate({ description: 'Event type identifier' }),
  table: Schema.String.annotate({ description: 'Table that was unsubscribed from' }),
  subscriptionId: optionalField(
    Schema.String.annotate({ description: 'Client handshake id for this subscription' })
  ),
})

// ---------------------------------------------------------------------------
// Realtime presence schemas
// ---------------------------------------------------------------------------

/**
 * Schema for a single presence entry — a user currently viewing a page.
 *
 * `pagePath` scopes presence per page route: presence on
 * `/tasks` is independent from presence on `/projects`. `joinedAt` is the
 * server-set timestamp the user's connection joined the presence channel.
 */
export const realtimePresenceEntrySchema = Schema.Struct({
  id: Schema.String.annotate({ description: 'User identifier' }),
  name: Schema.String.annotate({ description: 'User display name' }),
  avatarUrl: optionalField(uri({ description: 'User avatar URL' })),
  pagePath: Schema.String.annotate({ description: 'Page path the presence entry is scoped to' }),
  joinedAt: looseIsoDateTime({ description: 'ISO 8601 timestamp the user joined the page' }),
})

/**
 * Schema for user presence join events.
 *
 * Broadcast to other connected users on the same page path when a user
 * opens a page that has `presence: true` configured.
 */
export const realtimePresenceJoinSchema = Schema.Struct({
  type: Schema.Literal('join').annotate({ description: 'Event type identifier' }),
  user: realtimePresenceEntrySchema,
})

/**
 * Schema for user presence leave events.
 *
 * Broadcast when a user navigates away, disconnects, or their presence
 * entry is reaped after the stale-cleanup window (60s without heartbeat).
 */
export const realtimePresenceLeaveSchema = Schema.Struct({
  type: Schema.Literal('leave').annotate({ description: 'Event type identifier' }),
  userId: Schema.String.annotate({ description: 'Identifier of the user who left' }),
  pagePath: Schema.String.annotate({ description: 'Page path the user left' }),
})

/**
 * Schema for a presence sync snapshot.
 *
 * Sent once on join so a newly-connected user immediately receives the full
 * list of other users already viewing the same page path, rather than
 * waiting for incremental join events.
 */
export const realtimePresenceSyncSchema = Schema.Struct({
  type: Schema.Literal('presence-sync').annotate({ description: 'Event type identifier' }),
  pagePath: Schema.String.annotate({
    description: 'Page path this presence snapshot is scoped to',
  }),
  users: Schema.Array(realtimePresenceEntrySchema).annotate({
    description: 'All users currently viewing the page',
  }),
})

// ---------------------------------------------------------------------------
// Realtime connection status
// ---------------------------------------------------------------------------

/**
 * Schema for the transport connection status exposed to page components.
 *
 * Surfaced via the `data-connection-status` attribute so
 * a page section can render a connection indicator. The status is
 * transport-agnostic — it reflects logical connectivity regardless of
 * whether the active transport is WebSocket, SSE, or poll fallback.
 */
export const realtimeConnectionStatusSchema = Schema.Struct({
  type: Schema.Literal('connection-status').annotate({ description: 'Event type identifier' }),
  status: Schema.Literals(['connected', 'reconnecting', 'disconnected']).annotate({
    description: 'Logical connectivity state of the realtime transport',
  }),
  transport: Schema.Literals(['websocket', 'sse', 'poll']).annotate({
    description: 'Active transport in the WebSocket -> SSE -> poll fallback chain',
  }),
})

// ---------------------------------------------------------------------------
// Realtime message union schema
// ---------------------------------------------------------------------------

/**
 * Union of all possible realtime message types delivered over a transport
 * connection (WebSocket frames or SSE `data:` events — identical format).
 */
export const realtimeMessageSchema = Schema.Union([
  realtimeChangeEventSchema,
  realtimeConflictEventSchema,
  realtimeHeartbeatSchema,
  realtimeSubscribedSchema,
  realtimeUnsubscribedSchema,
  realtimePresenceJoinSchema,
  realtimePresenceLeaveSchema,
  realtimePresenceSyncSchema,
  realtimeConnectionStatusSchema,
])

// ---------------------------------------------------------------------------
// Subscription handshake schema
// ---------------------------------------------------------------------------

/**
 * Schema for the subscription handshake a client sends when opening a
 * transport connection.
 *
 * `filter` is an opaque server-evaluated expression string (the same
 * `field:operator:value` form accepted by the `?filter=` query param);
 * `fields` is a whitelist of column names the subscription wants in change
 * events. Both are optional — an unscoped subscription receives every
 * change for the table with every readable field.
 */
export const subscriptionHandshakeSchema = Schema.Struct({
  table: Schema.String.annotate({ description: 'Table slug to subscribe to' }).pipe(
    Schema.check(Schema.isMinLength(1))
  ),
  subscriptionId: optionalField(
    Schema.String.annotate({
      description: 'Client-generated id used to multiplex events on one connection',
    }).pipe(Schema.check(Schema.isMinLength(1)))
  ),
  filter: optionalField(
    Schema.String.annotate({
      description: 'Server-side filter expression applied to change events (field:operator:value)',
    })
  ),
  fields: optionalField(
    Schema.Array(Schema.String.pipe(Schema.check(Schema.isMinLength(1))))
      .annotate({ description: 'Whitelist of field names to include in change event payloads' })
      .pipe(Schema.check(Schema.isMinLength(1)))
  ),
})

// ---------------------------------------------------------------------------
// WebSocket transport configuration
// ---------------------------------------------------------------------------

/**
 * Schema for the realtime WebSocket transport configuration.
 *
 * These are operator-invariant protocol constants (not per-app schema
 * config): they describe the contract every Sovrium realtime client and
 * server obey. They are exposed as a schema so the client island and the
 * server handler share a single typed source of truth.
 *
 * - `reconnectBackoffMs`: exponential reconnect delays.
 * - `maxReconnectDelayMs`: cap applied once the backoff sequence is
 *   exhausted (30s).
 * - `heartbeatIntervalMs`: server heartbeat cadence.
 * - `maxConnectionsPerUser`: concurrent transport connection cap
 *.
 * - `idleConnectionTimeoutMs`: idle (zero-subscription) connection reap
 * window.
 * - `presenceStaleTimeoutMs`: presence entry reap window without heartbeat
 *.
 * - `maxPresenceEntriesPerPage`: presence entry cap per page path
 *.
 */
export const webSocketTransportConfigSchema = Schema.Struct({
  reconnectBackoffMs: Schema.Array(Schema.Int.pipe(Schema.check(Schema.isGreaterThan(0)))).annotate(
    { description: 'Exponential reconnect backoff delay sequence in milliseconds' }
  ),
  maxReconnectDelayMs: Schema.Int.annotate({
    description: 'Maximum reconnect delay after the backoff sequence is exhausted',
  }).pipe(Schema.check(Schema.isGreaterThan(0))),
  heartbeatIntervalMs: Schema.Int.annotate({
    description: 'Interval between server heartbeat messages',
  }).pipe(Schema.check(Schema.isGreaterThan(0))),
  maxConnectionsPerUser: Schema.Int.annotate({
    description: 'Maximum concurrent transport connections per authenticated user',
  }).pipe(Schema.check(Schema.isGreaterThan(0))),
  idleConnectionTimeoutMs: Schema.Int.annotate({
    description: 'Window after which an idle connection with no subscriptions is closed',
  }).pipe(Schema.check(Schema.isGreaterThan(0))),
  presenceStaleTimeoutMs: Schema.Int.annotate({
    description: 'Window after which a presence entry with no heartbeat is reaped',
  }).pipe(Schema.check(Schema.isGreaterThan(0))),
  maxPresenceEntriesPerPage: Schema.Int.annotate({
    description: 'Maximum concurrent presence entries per page path',
  }).pipe(Schema.check(Schema.isGreaterThan(0))),
})

/**
 * The canonical realtime transport configuration values.
 *
 * Frozen so client and server import the exact same constants; any spec
 * asserting a backoff delay, heartbeat cadence, or connection cap reads
 * from this single object.
 */
export const REALTIME_TRANSPORT_CONFIG = Object.freeze({
  reconnectBackoffMs: Object.freeze([1000, 2000, 4000, 8000]),
  maxReconnectDelayMs: 30_000,
  heartbeatIntervalMs: 30_000,
  maxConnectionsPerUser: 10,
  idleConnectionTimeoutMs: 5 * 60_000,
  presenceStaleTimeoutMs: 60_000,
  maxPresenceEntriesPerPage: 50,
}) satisfies Readonly<{
  readonly reconnectBackoffMs: readonly number[]
  readonly maxReconnectDelayMs: number
  readonly heartbeatIntervalMs: number
  readonly maxConnectionsPerUser: number
  readonly idleConnectionTimeoutMs: number
  readonly presenceStaleTimeoutMs: number
  readonly maxPresenceEntriesPerPage: number
}>

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type RealtimeRecordPayload = typeof realtimeRecordPayloadSchema.Type
export type RealtimeChangeEvent = typeof realtimeChangeEventSchema.Type
export type RealtimeConflictEvent = typeof realtimeConflictEventSchema.Type
export type RealtimeHeartbeat = typeof realtimeHeartbeatSchema.Type
export type RealtimeSubscribed = typeof realtimeSubscribedSchema.Type
export type RealtimeUnsubscribed = typeof realtimeUnsubscribedSchema.Type
export type RealtimePresenceEntry = typeof realtimePresenceEntrySchema.Type
export type RealtimePresenceJoin = typeof realtimePresenceJoinSchema.Type
export type RealtimePresenceLeave = typeof realtimePresenceLeaveSchema.Type
export type RealtimePresenceSync = typeof realtimePresenceSyncSchema.Type
export type RealtimeConnectionStatus = typeof realtimeConnectionStatusSchema.Type
export type RealtimeMessage = typeof realtimeMessageSchema.Type
export type SubscriptionHandshake = typeof subscriptionHandshakeSchema.Type
export type WebSocketTransportConfig = typeof webSocketTransportConfigSchema.Type
