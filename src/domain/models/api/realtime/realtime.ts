/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from 'zod'

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
export const realtimeRecordPayloadSchema = z.object({
  id: z.union([z.string(), z.number()]).describe('Identifier of the record'),
  fields: z
    .record(z.string(), z.unknown())
    .describe('Field-permission-filtered record field values'),
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
export const realtimeChangeEventSchema = z.object({
  type: z.literal('change').describe('Event type identifier'),
  event: z.enum(['insert', 'update', 'delete']).describe('Kind of record mutation'),
  table: z.string().describe('Table where the change occurred'),
  recordId: z.union([z.string(), z.number()]).describe('Identifier of the affected record'),
  subscriptionId: z
    .string()
    .optional()
    .describe('Client handshake id this event belongs to (multiplexing)'),
  record: realtimeRecordPayloadSchema
    .optional()
    .describe('Full record payload (present for insert and update events)'),
  oldRecord: realtimeRecordPayloadSchema
    .optional()
    .describe('Previous record payload (present for update events only)'),
  timestamp: z.string().datetime().describe('ISO 8601 timestamp of the change'),
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
export const realtimeConflictEventSchema = z.object({
  type: z.literal('conflict').describe('Event type identifier'),
  table: z.string().describe('Table where the conflict occurred'),
  recordId: z.union([z.string(), z.number()]).describe('Identifier of the contested record'),
  overwrittenFields: z
    .array(z.string())
    .min(1)
    .describe('Field name(s) whose pending optimistic value was overwritten'),
  overwrittenBy: z
    .object({
      id: z.string().describe('User id of the writer whose change won'),
      name: z.string().describe('Display name of the writer whose change won'),
    })
    .describe('The user whose concurrent write overwrote the pending change'),
  authoritativeRecord: realtimeRecordPayloadSchema.describe(
    'Server-authoritative record state the client must reconcile to'
  ),
  timestamp: z.string().datetime().describe('ISO 8601 timestamp of the conflict'),
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
export const realtimeHeartbeatSchema = z.object({
  type: z.literal('heartbeat').describe('Event type identifier'),
  timestamp: z.string().datetime().describe('ISO 8601 timestamp of the heartbeat'),
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
export const realtimeSubscribedSchema = z.object({
  type: z.literal('subscribed').describe('Event type identifier'),
  table: z.string().describe('Table that was subscribed to'),
  subscriptionId: z.string().optional().describe('Client handshake id for this subscription'),
  filter: z
    .string()
    .optional()
    .describe('Resolved filter expression applied server-side to change events'),
  fields: z
    .array(z.string())
    .optional()
    .describe('Resolved field whitelist applied server-side to change events'),
})

/**
 * Schema for unsubscription confirmation messages.
 */
export const realtimeUnsubscribedSchema = z.object({
  type: z.literal('unsubscribed').describe('Event type identifier'),
  table: z.string().describe('Table that was unsubscribed from'),
  subscriptionId: z.string().optional().describe('Client handshake id for this subscription'),
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
export const realtimePresenceEntrySchema = z.object({
  id: z.string().describe('User identifier'),
  name: z.string().describe('User display name'),
  avatarUrl: z.string().url().optional().describe('User avatar URL'),
  pagePath: z.string().describe('Page path the presence entry is scoped to'),
  joinedAt: z.string().datetime().describe('ISO 8601 timestamp the user joined the page'),
})

/**
 * Schema for user presence join events.
 *
 * Broadcast to other connected users on the same page path when a user
 * opens a page that has `presence: true` configured.
 */
export const realtimePresenceJoinSchema = z.object({
  type: z.literal('join').describe('Event type identifier'),
  user: realtimePresenceEntrySchema,
})

/**
 * Schema for user presence leave events.
 *
 * Broadcast when a user navigates away, disconnects, or their presence
 * entry is reaped after the stale-cleanup window (60s without heartbeat).
 */
export const realtimePresenceLeaveSchema = z.object({
  type: z.literal('leave').describe('Event type identifier'),
  userId: z.string().describe('Identifier of the user who left'),
  pagePath: z.string().describe('Page path the user left'),
})

/**
 * Schema for a presence sync snapshot.
 *
 * Sent once on join so a newly-connected user immediately receives the full
 * list of other users already viewing the same page path, rather than
 * waiting for incremental join events.
 */
export const realtimePresenceSyncSchema = z.object({
  type: z.literal('presence-sync').describe('Event type identifier'),
  pagePath: z.string().describe('Page path this presence snapshot is scoped to'),
  users: z.array(realtimePresenceEntrySchema).describe('All users currently viewing the page'),
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
export const realtimeConnectionStatusSchema = z.object({
  type: z.literal('connection-status').describe('Event type identifier'),
  status: z
    .enum(['connected', 'reconnecting', 'disconnected'])
    .describe('Logical connectivity state of the realtime transport'),
  transport: z
    .enum(['websocket', 'sse', 'poll'])
    .describe('Active transport in the WebSocket -> SSE -> poll fallback chain'),
})

// ---------------------------------------------------------------------------
// Realtime message union schema
// ---------------------------------------------------------------------------

/**
 * Union of all possible realtime message types delivered over a transport
 * connection (WebSocket frames or SSE `data:` events — identical format).
 */
export const realtimeMessageSchema = z.discriminatedUnion('type', [
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
export const subscriptionHandshakeSchema = z.object({
  table: z.string().min(1).describe('Table slug to subscribe to'),
  subscriptionId: z
    .string()
    .min(1)
    .optional()
    .describe('Client-generated id used to multiplex events on one connection'),
  filter: z
    .string()
    .optional()
    .describe('Server-side filter expression applied to change events (field:operator:value)'),
  fields: z
    .array(z.string().min(1))
    .min(1)
    .optional()
    .describe('Whitelist of field names to include in change event payloads'),
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
export const webSocketTransportConfigSchema = z.object({
  reconnectBackoffMs: z
    .array(z.number().int().positive())
    .describe('Exponential reconnect backoff delay sequence in milliseconds'),
  maxReconnectDelayMs: z
    .number()
    .int()
    .positive()
    .describe('Maximum reconnect delay after the backoff sequence is exhausted'),
  heartbeatIntervalMs: z
    .number()
    .int()
    .positive()
    .describe('Interval between server heartbeat messages'),
  maxConnectionsPerUser: z
    .number()
    .int()
    .positive()
    .describe('Maximum concurrent transport connections per authenticated user'),
  idleConnectionTimeoutMs: z
    .number()
    .int()
    .positive()
    .describe('Window after which an idle connection with no subscriptions is closed'),
  presenceStaleTimeoutMs: z
    .number()
    .int()
    .positive()
    .describe('Window after which a presence entry with no heartbeat is reaped'),
  maxPresenceEntriesPerPage: z
    .number()
    .int()
    .positive()
    .describe('Maximum concurrent presence entries per page path'),
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

export type RealtimeRecordPayload = z.infer<typeof realtimeRecordPayloadSchema>
export type RealtimeChangeEvent = z.infer<typeof realtimeChangeEventSchema>
export type RealtimeConflictEvent = z.infer<typeof realtimeConflictEventSchema>
export type RealtimeHeartbeat = z.infer<typeof realtimeHeartbeatSchema>
export type RealtimeSubscribed = z.infer<typeof realtimeSubscribedSchema>
export type RealtimeUnsubscribed = z.infer<typeof realtimeUnsubscribedSchema>
export type RealtimePresenceEntry = z.infer<typeof realtimePresenceEntrySchema>
export type RealtimePresenceJoin = z.infer<typeof realtimePresenceJoinSchema>
export type RealtimePresenceLeave = z.infer<typeof realtimePresenceLeaveSchema>
export type RealtimePresenceSync = z.infer<typeof realtimePresenceSyncSchema>
export type RealtimeConnectionStatus = z.infer<typeof realtimeConnectionStatusSchema>
export type RealtimeMessage = z.infer<typeof realtimeMessageSchema>
export type SubscriptionHandshake = z.infer<typeof subscriptionHandshakeSchema>
export type WebSocketTransportConfig = z.infer<typeof webSocketTransportConfigSchema>
