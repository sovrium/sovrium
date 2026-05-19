/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../template'
import { ActionBaseFields } from './base'

const NotificationTargetSchema = Schema.Struct({
  users: Schema.optional(
    Schema.Array(TemplateStringSchema).pipe(
      Schema.annotations({ description: 'Specific user IDs to notify' })
    )
  ),

  roles: Schema.optional(
    Schema.Array(Schema.String).pipe(
      Schema.annotations({ description: 'Role names — all users with matching role are notified' })
    )
  ),

  all: Schema.optional(
    Schema.Boolean.pipe(Schema.annotations({ description: 'Send to all app users' }))
  ),
}).pipe(
  Schema.annotations({
    identifier: 'NotificationTarget',
    title: 'Notification Target',
    description: 'Who receives the notification — by user ID, role, or all users.',
  })
)

export const SendNotificationActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('notification'),
  operator: Schema.Literal('send'),
  props: Schema.Struct({
    template: Schema.String.pipe(
      Schema.annotations({
        description: 'Notification template name (from app.notifications.templates)',
      })
    ),

    target: NotificationTargetSchema,

    variables: Schema.optional(
      Schema.Record({ key: Schema.String, value: Schema.Unknown }).pipe(
        Schema.annotations({ description: 'Template variable substitution values' })
      )
    ),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'SendNotificationAction',
    title: 'Send Notification Action',
    description:
      'Automation action to send in-app/email notifications to targeted users via a named template.',
  })
)

export type SendNotificationAction = Schema.Schema.Type<typeof SendNotificationActionSchema>
