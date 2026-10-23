/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { looseIsoDateTime } from '@/domain/models/api/combinators/formats'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

/**
 * Notifications API schemas — the caller's own notifications.
 *
 * - `GET  /api/notifications` — her notifications, newest first, with her unread count
 * - `POST /api/notifications/:id/read` — mark the one she opened
 * - `POST /api/notifications/read-all` — the explicit "Mark all read"
 * - `GET  /api/notifications/preferences` — her channels per declared kind
 * - `PUT  /api/notifications/preferences` — change them
 *
 * Every route reads the session's own rows. There is no recipient parameter,
 * so another person's notification is unreachable by construction, and an id
 * that is not hers answers 404 exactly as an unknown one does.
 *
 * A notification carries the source's table and id, never a copy of its
 * fields: opening it reads the record under the reader's permissions then.
 */

const nullableString = (description: string) =>
  Schema.NullOr(Schema.String).annotate({ description })

export const notificationSourceSchema = Schema.Struct({
  table: Schema.String.annotate({ description: 'Table of the record the notification is about' }),
  recordId: Schema.String.annotate({ description: 'Id of that record' }),
}).annotate({
  description:
    'The record the notification is about, by table and id only; read it through the records API to see what the reader may see of it now',
})

export const notificationSchema = Schema.Struct({
  id: Schema.String.annotate({ description: 'Notification identifier' }),
  kind: Schema.String.annotate({
    description: 'The declared kind of the notification (notifications.kinds[].name)',
  }),
  title: Schema.String.annotate({ description: 'Title, as the action rendered it' }),
  body: nullableString('Text under the title, or null when the action set none'),
  source: Schema.NullOr(notificationSourceSchema).annotate({
    description: 'The record the notification is about, or null',
  }),
  read: Schema.Boolean.annotate({ description: 'Whether the recipient has marked it read' }),
  createdAt: looseIsoDateTime({ description: 'When the notification was created' }),
  readAt: Schema.NullOr(looseIsoDateTime({ description: 'When it was marked read' })).annotate({
    description: 'When it was marked read, or null while unread',
  }),
})

export const listNotificationsResponseSchema = Schema.Struct({
  notifications: Schema.Array(notificationSchema).annotate({
    description: "The caller's notifications, newest first",
  }),
  unreadCount: Schema.Int.annotate({
    description: "How many of the caller's notifications are unread",
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
})

export const markNotificationReadResponseSchema = Schema.Struct({
  notification: notificationSchema,
  unreadCount: Schema.Int.annotate({
    description: "The caller's unread count after the change",
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
})

export const markAllNotificationsReadResponseSchema = Schema.Struct({
  marked: Schema.Int.annotate({
    description: 'How many notifications this call marked read',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  unreadCount: Schema.Int.annotate({
    description: "The caller's unread count after the change, always 0",
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
})

export const notificationChannelsSchema = Schema.Struct({
  inApp: Schema.Boolean.annotate({ description: 'Listed in her notifications' }),
  email: Schema.Boolean.annotate({ description: 'Sent to her account address' }),
  digest: Schema.Boolean.annotate({ description: 'Left for a digest to collect' }),
})

export const notificationPreferenceSchema = Schema.Struct({
  kind: Schema.String.annotate({ description: 'The declared kind' }),
  label: Schema.String.annotate({ description: 'How the kind is named to her' }),
  channels: notificationChannelsSchema.annotate({
    description:
      "Her channels for the kind: her choice where she made one, the kind's default otherwise",
  }),
})

export const notificationPreferencesResponseSchema = Schema.Struct({
  preferences: Schema.Array(notificationPreferenceSchema).annotate({
    description: 'One entry per declared kind, in declaration order',
  }),
})

/** The most kinds one preferences update may change. */
export const MAX_PREFERENCE_CHANGES = 100

export const updateNotificationPreferencesRequestSchema = Schema.Struct({
  preferences: Schema.Array(
    Schema.Struct({
      kind: Schema.String.annotate({ description: 'A declared kind' }).pipe(
        Schema.check(Schema.isMinLength(1))
      ),
      channels: Schema.Struct({
        inApp: optionalField(
          Schema.Boolean.annotate({ description: 'Listed in her notifications' })
        ),
        email: optionalField(
          Schema.Boolean.annotate({ description: 'Sent to her account address' })
        ),
        digest: optionalField(
          Schema.Boolean.annotate({ description: 'Left for a digest to collect' })
        ),
      }).annotate({ description: 'The channels to change; a channel left out keeps its value' }),
    })
  )
    .annotate({
      description:
        'The kinds whose channels change, at most 100; a kind the app does not declare is refused, and a kind named twice takes its last entry',
    })
    .pipe(Schema.check(Schema.isMaxLength(MAX_PREFERENCE_CHANGES))),
})

/** @public */
export type Notification = Schema.Schema.Type<typeof notificationSchema>
/** @public */
export type ListNotificationsResponse = Schema.Schema.Type<typeof listNotificationsResponseSchema>
/** @public */
export type NotificationPreferencesResponse = Schema.Schema.Type<
  typeof notificationPreferencesResponseSchema
>
/** @public */
export type UpdateNotificationPreferencesRequest = Schema.Schema.Type<
  typeof updateNotificationPreferencesRequestSchema
>
