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

export { DigestConfigSchema } from './digest-config'
export { NotificationChannelSchema } from './channels'
export { NotificationTemplateSchema } from './templates'
export { DefaultSubscribersSchema, RecordSubscriptionSchema } from './record-subscriptions'


export const NotificationSchema = Schema.Struct({
  channels: Schema.optional(
    Schema.Array(NotificationChannelSchema).pipe(
      Schema.annotations({
        title: 'Notification Channels',
        description: 'Configured notification delivery channels',
      })
    )
  ),

  templates: Schema.optional(
    Schema.Record({ key: Schema.String, value: NotificationTemplateSchema }).pipe(
      Schema.annotations({
        title: 'Notification Templates',
        description: 'Named notification templates for different event types',
      })
    )
  ),

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

export type Notification = Schema.Schema.Type<typeof NotificationSchema>
export type NotificationEncoded = Schema.Schema.Encoded<typeof NotificationSchema>
