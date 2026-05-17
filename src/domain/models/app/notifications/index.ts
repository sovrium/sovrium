/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { NotificationChannelSchema } from './channels'
import { RecordSubscriptionSchema } from './record-subscriptions'
import { NotificationTemplateSchema } from './templates'

// Re-export sub-schemas for convenient imports
export { DigestConfigSchema } from './digest-config'
export { NotificationChannelSchema } from './channels'
export { NotificationTemplateSchema } from './templates'
export { DefaultSubscribersSchema, RecordSubscriptionSchema } from './record-subscriptions'

// ─── Top-Level Notification Configuration ────────────────────────────────────

/**
 * Notification system configuration.
 *
 * When present in the app config, the notification system is enabled.
 * When omitted, no notification endpoints are available.
 *
 * @example
 * ```typescript
 * {
 *   channels: [
 *     { type: 'inApp', enabled: true },
 *     { type: 'email', enabled: true, from: 'alerts@myapp.com' },
 *   ],
 *   templates: {
 *     recordCreated: {
 *       title: 'New {{tableName}} record',
 *       body: '{{userName}} created a new record in {{tableName}}',
 *       channels: ['inApp', 'email'],
 *     },
 *     mention: {
 *       title: '{{userName}} mentioned you',
 *       body: '{{userName}} mentioned you in a comment on {{recordTitle}}',
 *       channels: ['inApp', 'email'],
 *     },
 *   },
 *   recordSubscriptions: [
 *     { table: 'orders', events: ['created', 'updated'], defaultSubscribers: { roles: ['admin'] } },
 *   ],
 * }
 * ```
 */
export const NotificationSchema = Schema.Struct({
  /** Notification delivery channels (inApp, email). */
  channels: Schema.optional(
    Schema.Array(NotificationChannelSchema).pipe(
      Schema.annotations({
        title: 'Notification Channels',
        description: 'Configured notification delivery channels',
      })
    )
  ),

  /** Named notification templates with {{variable}} substitution. */
  templates: Schema.optional(
    Schema.Record({ key: Schema.String, value: NotificationTemplateSchema }).pipe(
      Schema.annotations({
        title: 'Notification Templates',
        description: 'Named notification templates for different event types',
      })
    )
  ),

  /** Record change subscriptions for automatic notifications on table events. */
  recordSubscriptions: Schema.optional(
    Schema.Array(RecordSubscriptionSchema).pipe(
      Schema.annotations({
        title: 'Record Subscriptions',
        description: 'Table record change subscriptions for automatic notifications',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'Notification',
    title: 'Notification Configuration',
    description:
      'Declarative notification system with channels, templates, and record subscriptions. Disabled when omitted from app config.',
    examples: [
      {
        channels: [{ type: 'inApp' as const, enabled: true }],
        templates: {
          mention: {
            title: '{{userName}} mentioned you',
            body: '{{userName}} mentioned you in a comment on {{recordTitle}}',
            channels: ['inApp' as const],
          },
        },
      },
    ],
  })
)

/** @public */
export type Notification = Schema.Schema.Type<typeof NotificationSchema>
/** @public */
export type NotificationEncoded = Schema.Schema.Encoded<typeof NotificationSchema>
