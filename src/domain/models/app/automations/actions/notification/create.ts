/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

/**
 * Notification Action (type: notification, operator: create)
 *
 * Write one notification per recipient into the engine's notification store,
 * of a kind the app declares under the top-level `notifications`. Each
 * recipient's preference for the kind decides where it goes: in-app writes the
 * row she lists through `/api/notifications`, email sends it to her account
 * address through the email transport, digest keeps it for a later periodic
 * summary that this version does not yet send — neither listed nor emailed, and
 * removed after `notifications.retention.days`. A large recipient list is written in batches, so a
 * broadcast never holds one transaction open.
 *
 * The notification never copies a field of its source: it stores the source's
 * table and record id, and its title and body are this action's own templates.
 * Opening it resolves the source under the reader's permissions at that moment.
 *
 * `recipients` is the user ids to notify: a list of templates, or one template
 * that renders a list (`'{{trigger.mentions}}'`). An id that names no person is
 * skipped, never an error, so a mention of a departed colleague does not fail
 * the run.
 */
export const NotificationCreateActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('notification').pipe(
    Schema.annotate({
      description: "Constant value 'notification' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('create').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'notification' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    kind: Schema.String.pipe(
      Schema.annotate({
        description:
          'The kind of notification, one the app declares under notifications.kinds. It decides the default channels and the preference each recipient applies.',
        examples: ['mention', 'reply'],
      }),
      Schema.check(Schema.isMinLength(1))
    ),
    recipients: Schema.Union([
      TemplateStringSchema.pipe(
        Schema.annotate({
          description:
            "One template that renders a user id or a list of user ids, such as '{{trigger.mentions}}'",
        })
      ),
      Schema.Array(TemplateStringSchema).pipe(
        Schema.annotate({
          description: 'User ids to notify, each a template',
        }),
        Schema.check(Schema.isMinLength(1))
      ),
    ]).pipe(
      Schema.annotate({
        description:
          'Who to notify, by user id. Each recipient gets her own notification; an id that names no person is skipped.',
      })
    ),
    source: Schema.optional(
      Schema.Struct({
        table: Schema.String.pipe(
          Schema.annotate({ description: 'Table of the record the notification is about' }),
          Schema.check(Schema.isMinLength(1))
        ),
        recordId: TemplateStringSchema.pipe(
          Schema.annotate({
            description: 'Id of the record the notification is about, as a template',
          })
        ),
      }).pipe(
        Schema.annotate({
          description:
            'The record the notification is about. Only its table and id are stored; opening the notification reads the record under the reader’s permissions at that moment, so a record she may no longer read answers 404.',
        })
      )
    ),
    title: TemplateStringSchema.pipe(
      Schema.annotate({
        description:
          "The notification's title, as a template; also the subject of its email when the recipient receives the kind by email.",
      }),
      Schema.check(Schema.isMinLength(1))
    ),
    body: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          description: "The notification's text under its title, as a template.",
        })
      )
    ),
  }).pipe(
    Schema.annotate({
      description:
        'The kind, who to notify, the record it is about, and the title and text each recipient reads.',
    })
  ),
}).pipe(
  Schema.annotate({
    identifier: 'NotificationCreateAction',
    title: 'Notification Create Action',
    description:
      "Notify people of something: one notification per recipient, of a declared kind, listed in the app, sent by email, or kept for a periodic digest that this version does not yet send, as each recipient's preferences for that kind decide",
  })
)

/** @public */
export type NotificationCreateAction = Schema.Schema.Type<typeof NotificationCreateActionSchema>
