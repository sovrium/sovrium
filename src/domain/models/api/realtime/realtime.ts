/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from 'zod'


export const realtimeRecordPayloadSchema = z.object({
  id: z.union([z.string(), z.number()]).describe('Identifier of the record'),
  fields: z
    .record(z.string(), z.unknown())
    .describe('Field-permission-filtered record field values'),
})


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


export const realtimeHeartbeatSchema = z.object({
  type: z.literal('heartbeat').describe('Event type identifier'),
  timestamp: z.string().datetime().describe('ISO 8601 timestamp of the heartbeat'),
})


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

export const realtimeUnsubscribedSchema = z.object({
  type: z.literal('unsubscribed').describe('Event type identifier'),
  table: z.string().describe('Table that was unsubscribed from'),
  subscriptionId: z.string().optional().describe('Client handshake id for this subscription'),
})


export const realtimePresenceEntrySchema = z.object({
  id: z.string().describe('User identifier'),
  name: z.string().describe('User display name'),
  avatarUrl: z.string().url().optional().describe('User avatar URL'),
  pagePath: z.string().describe('Page path the presence entry is scoped to'),
  joinedAt: z.string().datetime().describe('ISO 8601 timestamp the user joined the page'),
})

export const realtimePresenceJoinSchema = z.object({
  type: z.literal('join').describe('Event type identifier'),
  user: realtimePresenceEntrySchema,
})

export const realtimePresenceLeaveSchema = z.object({
  type: z.literal('leave').describe('Event type identifier'),
  userId: z.string().describe('Identifier of the user who left'),
  pagePath: z.string().describe('Page path the user left'),
})

export const realtimePresenceSyncSchema = z.object({
  type: z.literal('presence-sync').describe('Event type identifier'),
  pagePath: z.string().describe('Page path this presence snapshot is scoped to'),
  users: z.array(realtimePresenceEntrySchema).describe('All users currently viewing the page'),
})


export const realtimeConnectionStatusSchema = z.object({
  type: z.literal('connection-status').describe('Event type identifier'),
  status: z
    .enum(['connected', 'reconnecting', 'disconnected'])
    .describe('Logical connectivity state of the realtime transport'),
  transport: z
    .enum(['websocket', 'sse', 'poll'])
    .describe('Active transport in the WebSocket -> SSE -> poll fallback chain'),
})


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
