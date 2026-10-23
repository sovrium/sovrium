/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `message-scroller` — a conversation's scroll frame: it opens at the latest
 * turn and keeps its place. shadcn/ui's Message Scroller, under its own name.
 *
 * It holds `message` turns and `marker` notes only (a semantic check,
 * `component-children-validation.ts`), is exposed as a log of additions, and
 * fills a box of a declared `height` — required, because a frame that grows
 * with its content never scrolls.
 *
 * ## Bound to a table, its children are the template
 *
 * With a `dataSource`, the frame draws one turn per readable record. Its
 * `children` are then not the turns but the anatomy of ONE turn — a `message`,
 * and optionally the `marker` drawn at each change of `dayField`'s day —
 * resolving `$record.*` per record, as a data-bound `container` does. There is
 * no second, poorer item vocabulary beside the `message` the frame already
 * holds. The copies are drawn by the server, under the records list's read
 * gate, and drawn again from it when the table changes, so
 * `dataSource.refreshMode: realtime` is honoured.
 *
 * `authorField` names the `user` field holding who wrote a record: the
 * reader's own turns sit at the end side, and consecutive turns by one author
 * share one name and picture. `dayField` names the date the frame splits days
 * on. Both only mean something on a bound frame.
 *
 * Source: [internal ref]
 */

import { Schema } from 'effect'
import { DataSourceSchema } from '../../data-source'
import { coreFields } from '../modules/core'
import { visibilityFields } from '../modules/visibility'

export const MessageScrollerTypeLiteral = Schema.Literal('message-scroller')

/** A CSS length a frame can be sized by. */
const CSS_LENGTH = /^\d+(?:\.\d+)?(?:px|rem|em|vh|dvh|svh|lvh|%)$/

export const messageScrollerFields = {
  ...coreFields,
  ...visibilityFields,
  height: Schema.String.annotate({
    title: 'Height',
    description:
      "The frame's height, as a CSS length (`320px`, `24rem`, `60vh`). Required: a frame that grows with its content never scrolls.",
    examples: ['320px', '60vh'],
  }).pipe(
    Schema.check(
      Schema.isPattern(CSS_LENGTH, {
        message: 'A height is a CSS length, for example 320px, 24rem or 60vh.',
      })
    )
  ),
  defaultScrollPosition: Schema.optional(
    Schema.Literals(['start', 'end', 'last-anchor']).annotate({
      title: 'Default Scroll Position',
      defaultNote: 'end',
      description:
        "Where the frame opens: 'end' (the latest turn in view), 'start' (the first line, for a transcript) or 'last-anchor' (the top of the last turn, with `anchorPeek` pixels of the one before it). shadcn/ui's Message Scroller defaultScrollPosition.",
    })
  ),
  autoScroll: Schema.optional(
    Schema.Boolean.annotate({
      title: 'Auto Scroll',
      defaultNote: 'false',
      description:
        'Follows new turns as they are added, while the reader is already at the end; a reader scrolled up keeps their place.',
    })
  ),
  anchorPeek: Schema.optional(
    Schema.Finite.annotate({
      title: 'Anchor Peek',
      defaultNote: '64',
      description:
        "How many pixels of the turn before the last stay in view when the frame opens at 'last-anchor'.",
    }).pipe(Schema.check(Schema.isInt()), Schema.check(Schema.isGreaterThanOrEqualTo(0)))
  ),
  /**
   * The table the conversation is read from — the shared binding, so `filter`,
   * `sort`, `limit` and `refreshMode` read as on every data component. The
   * shared schema carries its own identifier and description; annotating it
   * here would fork that definition, so the field-level prose lives in the
   * component's manual fragment.
   */
  dataSource: Schema.optional(DataSourceSchema),
  authorField: Schema.optional(
    Schema.String.annotate({
      title: 'Author Field',
      description:
        "The `user` field of the bound table holding who wrote each record. The signed-in reader's own turns sit at the end side, and consecutive turns by one author share one name and picture. Only on a frame with a `dataSource`.",
      examples: ['author'],
    }).pipe(Schema.check(Schema.isMinLength(1)))
  ),
  dayField: Schema.optional(
    Schema.String.annotate({
      title: 'Day Field',
      description:
        "The date or date-time field of the bound table the conversation is split into days on: a date marker is drawn before the first turn of each day, in the page language. Without a `marker` among the frame's children, the marker is a separator naming the day; with one, that marker is drawn instead, its `$record.<field>` read from the day's first record. Only on a frame with a `dataSource`.",
      examples: ['created_at'],
    }).pipe(Schema.check(Schema.isMinLength(1)))
  ),
} as const
