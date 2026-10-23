/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `message` — one turn of a conversation: who said it, when, on which side of
 * the thread, and the surface that holds what was said. shadcn/ui's Message,
 * under its own name.
 *
 * ## The surface is a child
 *
 * A message holds its content as `children` — a `bubble`, an `attachment`, a
 * `marker`, a `text` — so one turn can carry a sentence and a file. Its
 * `header` and `footer` are component slots drawn above and below them.
 *
 * ## A group is consecutive turns, not a key
 *
 * Consecutive turns by the same `author` print the name once, at the first
 * turn: the renderer sees the run, so there is nothing to declare.
 *
 * ## Sides are logical
 *
 * `align: start | end`, never left and right, so a right-to-left page mirrors
 * the thread with no second key.
 *
 * Source: [internal ref]
 */

import { Schema } from 'effect'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const MessageTypeLiteral = Schema.Literal('message')

/** A field of the record a bound turn is drawn for. */
const RECORD_REFERENCE = /^\$record\.[A-Za-z_][A-Za-z0-9_]*$/

/** Which side of the thread a turn sits on. */
export const MessageAlignSchema = Schema.Literals(['start', 'end']).annotate({
  title: 'Message Align',
  defaultNote: 'start',
  description:
    "Which side of the thread the turn sits on: 'start' (the default, the sender's side) or 'end' (the reply). Logical, so a right-to-left page mirrors it. shadcn/ui's Message align.",
})

/** The picture beside a turn. */
export const MessageAvatarSchema = Schema.Struct({
  src: Schema.optional(Schema.String.annotate({ description: 'The address of the picture.' })),
  initials: Schema.optional(
    Schema.String.annotate({
      description: 'Up to two letters drawn when there is no picture.',
      examples: ['LM'],
    }).pipe(Schema.check(Schema.isMaxLength(2)))
  ),
}).annotate({
  title: 'Message Avatar',
  description: 'The picture or the initials of the author, drawn beside the turn.',
})

export const messageFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  align: Schema.optional(MessageAlignSchema),
  author: Schema.optional(
    Schema.String.annotate({
      title: 'Author',
      description:
        'Who said it. Printed once per run: consecutive turns by the same author print the name at the first turn only.',
      examples: ['Léa Moreau'],
    })
  ),
  avatar: Schema.optional(MessageAvatarSchema),
  timestamp: Schema.optional(
    Schema.String.annotate({
      title: 'Timestamp',
      description:
        'When it was said, as an ISO date-time, or `$record.<field>` naming a date-time field when the turn is the template of a bound `message-scroller`. Drawn as a time element, formatted in the page language.',
      examples: ['2026-10-12T09:14:00Z', '$record.created_at'],
    }).pipe(
      Schema.check(
        Schema.makeFilter(
          (value: string) =>
            RECORD_REFERENCE.test(value) ||
            !Number.isNaN(Date.parse(value)) ||
            'A timestamp is an ISO date-time, for example 2026-10-12T09:14:00Z, or a $record.<field> reference.'
        )
      )
    )
  ),
  replies: Schema.optional(
    Schema.Boolean.annotate({
      title: 'Replies',
      defaultNote: 'false',
      description:
        "Draws the summary of the record's comment thread under the turn: how many replies, the pictures of the last three people who replied and when the last reply was posted. Opening it shows the thread in a sheet. Only on the turn template of a bound `message-scroller`, whose table allows comments; a turn with no reply draws no summary.",
    })
  ),
} as const
