/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Realtime change event schema
// ---------------------------------------------------------------------------

/**
 * Schema for a record change event pushed to subscribed clients.
 */
export const realtimeChangeEventSchema = z.object({
  type: z.literal('change').describe('Event type identifier'),
  event: z.enum(['insert', 'update', 'delete']).describe('Kind of record mutation'),
  table: z.string().describe('Table where the change occurred'),
  recordId: z.union([z.string(), z.number()]).describe('Identifier of the affected record'),
  record: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Full record data (present for insert and update events)'),
  oldRecord: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Previous record data (present for update events only)'),
  timestamp: z.string().datetime().describe('ISO 8601 timestamp of the change'),
})

// ---------------------------------------------------------------------------
// Realtime heartbeat schema
// ---------------------------------------------------------------------------

/**
 * Schema for keep-alive heartbeat messages.
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
 */
export const realtimeSubscribedSchema = z.object({
  type: z.literal('subscribed').describe('Event type identifier'),
  table: z.string().describe('Table that was subscribed to'),
})

/**
 * Schema for unsubscription confirmation messages.
 */
export const realtimeUnsubscribedSchema = z.object({
  type: z.literal('unsubscribed').describe('Event type identifier'),
  table: z.string().describe('Table that was unsubscribed from'),
})

// ---------------------------------------------------------------------------
// Realtime presence schemas
// ---------------------------------------------------------------------------

/**
 * Schema for user presence join events.
 */
export const realtimePresenceJoinSchema = z.object({
  type: z.literal('join').describe('Event type identifier'),
  user: z.object({
    id: z.string().describe('User identifier'),
    name: z.string().describe('User display name'),
    avatarUrl: z.string().url().optional().describe('User avatar URL'),
  }),
})

/**
 * Schema for user presence leave events.
 */
export const realtimePresenceLeaveSchema = z.object({
  type: z.literal('leave').describe('Event type identifier'),
  userId: z.string().describe('Identifier of the user who left'),
})

// ---------------------------------------------------------------------------
// Realtime message union schema
// ---------------------------------------------------------------------------

/**
 * Union of all possible realtime message types.
 */
export const realtimeMessageSchema = z.discriminatedUnion('type', [
  realtimeChangeEventSchema,
  realtimeHeartbeatSchema,
  realtimeSubscribedSchema,
  realtimeUnsubscribedSchema,
  realtimePresenceJoinSchema,
  realtimePresenceLeaveSchema,
])

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type RealtimeChangeEvent = z.infer<typeof realtimeChangeEventSchema>
export type RealtimeHeartbeat = z.infer<typeof realtimeHeartbeatSchema>
export type RealtimeSubscribed = z.infer<typeof realtimeSubscribedSchema>
export type RealtimeUnsubscribed = z.infer<typeof realtimeUnsubscribedSchema>
export type RealtimePresenceJoin = z.infer<typeof realtimePresenceJoinSchema>
export type RealtimePresenceLeave = z.infer<typeof realtimePresenceLeaveSchema>
export type RealtimeMessage = z.infer<typeof realtimeMessageSchema>
