/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../template'
import { ActionBaseFields } from './base'

/**
 * Notification target — specifies who receives the notification.
 *
 * At least one of `users`, `roles`, or `all` should be set.
 */
const NotificationTargetSchema = Schema.Struct({
  /** Specific user IDs to notify (supports {{variable}} references). */
  users: Schema.optional(
    Schema.Array(TemplateStringSchema).pipe(
      Schema.annotations({ description: 'Specific user IDs to notify' })
    )
  ),

  /** Roles whose members receive the notification. */
  roles: Schema.optional(
    Schema.Array(Schema.String).pipe(
      Schema.annotations({ description: 'Role names — all users with matching role are notified' })
    )
  ),

  /** Notify all app users. */
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

/**
 * Send Notification Action (type: notification, operator: send)
 *
 * Sends a notification to targeted users using a named template.
 * The template must reference a template defined in `app.notifications.templates`.
 *
 * @example
 * ```typescript
 * {
 *   name: 'notifySales',
 *   type: 'notification',
 *   operator: 'send',
 *   props: {
 *     template: 'largeOrderAlert',
 *     target: { roles: ['admin', 'member'] },
 *     variables: { orderTotal: '{{record.total}}' },
 *   },
 * }
 * ```
 */
export const SendNotificationActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('notification'),
  operator: Schema.Literal('send'),
  props: Schema.Struct({
    /** Notification template name (must match a key in app.notifications.templates). */
    template: Schema.String.pipe(
      Schema.annotations({
        description: 'Notification template name (from app.notifications.templates)',
      })
    ),

    /** Who receives the notification. */
    target: NotificationTargetSchema,

    /** Variables for template {{variable}} substitution (optional). */
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

/** @public */
export type SendNotificationAction = Schema.Schema.Type<typeof SendNotificationActionSchema>
