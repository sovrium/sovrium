/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { DefaultSubscribersSchema } from './default-subscribers'

export { DefaultSubscribersSchema } from './default-subscribers'

// ─── Record Subscriptions ───────────────────────────────────────────────────

/**
 * Record change subscription — configures which table events trigger notifications.
 *
 * @example
 * ```typescript
 * {
 *   table: 'orders',
 *   events: ['created', 'updated'],
 *   fields: ['status', 'assignee'],
 *   defaultSubscribers: { roles: ['admin'] },
 * }
 * ```
 */
export const RecordSubscriptionSchema = Schema.Struct({
  /** Table name this subscription watches (validated against app.tables at AppSchema level). */
  table: Schema.String.pipe(
    Schema.annotations({ description: 'Table name to watch for record changes' })
  ),

  /** Events that trigger notifications. At least one required. */
  events: Schema.Array(Schema.Literal('created', 'updated', 'deleted')).pipe(
    Schema.minItems(1),
    Schema.annotations({
      title: 'Subscription Events',
      description: 'Record events that trigger notifications',
    })
  ),

  /** Optional field names — only notify when these fields change. All fields if omitted. */
  fields: Schema.optional(
    Schema.Array(Schema.String).pipe(
      Schema.annotations({ description: 'Field names to watch (all fields if omitted)' })
    )
  ),

  /** Default subscribers for this subscription. */
  defaultSubscribers: Schema.optional(DefaultSubscribersSchema),
}).pipe(
  Schema.annotations({
    identifier: 'RecordSubscription',
    title: 'Record Change Subscription',
    description: 'Subscribe to record CRUD events on a table for automatic notification delivery.',
  })
)
