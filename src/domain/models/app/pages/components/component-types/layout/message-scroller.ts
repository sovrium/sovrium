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
 * Source: [internal ref]
 */

import { Schema } from 'effect'
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
} as const
