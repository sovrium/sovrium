/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `bubble` — the surface of one chat turn, tinted by sender and set to its side
 * of the thread. shadcn/ui's Bubble, under its own name.
 *
 * ## A promotion, not a new surface
 *
 * The surface already ships: it is `card` with `variant: bubble`. This type is
 * that surface without the key that selected it, so its keys are picked from
 * {@link cardFields} — the message (`content`), interactions, `responsive`,
 * `visibility` and `i18n` — and `children` arrive with the container rule that
 * gives every container type its children.
 *
 * ## `align`, not `side`
 *
 * The card variant placed its tail with `side: left | right`, a physical side.
 * A bubble places it with `align: start | end`, the shadcn spelling and a
 * logical one: a thread in a right-to-left language puts the sender's tail on
 * the right with no second key. `side` is refused with a sentence naming the two
 * values. `variant` (the shadcn tints) is a later extension; until then a bubble
 * refuses it like any unknown key.
 *
 * ## Link previews are computed when content is stored, not when it is read
 *
 * `linkPreviews: true` draws a card per web address in the text. No route
 * takes an address from a reader: the server reads each address found in a
 * stored record in the background, through the one guarded egress, caches the
 * parsed fields by normalised address, and the renderer reads that cache only.
 */

import { Schema } from 'effect'
import { cardFields } from '../layout/card'

export const BubbleTypeLiteral = Schema.Literal('bubble')

/** Which side of the thread a bubble's tail sits on. */
export const BubbleAlignSchema = Schema.Literals(['start', 'end']).annotate({
  title: 'Bubble Align',
  defaultNote: 'start',
  description:
    "Which side of the thread the bubble sits on, its tail on that side: 'start' (the sender, default) or 'end' (the reply). Logical, so a right-to-left page mirrors it. shadcn/ui's Bubble align.",
})

export const bubbleFields = {
  props: cardFields.props,
  classes: cardFields.classes,
  content: cardFields.content,
  interactions: cardFields.interactions,
  responsive: cardFields.responsive,
  visibility: cardFields.visibility,
  i18n: cardFields.i18n,
  align: Schema.optional(BubbleAlignSchema),
  linkPreviews: Schema.optional(
    Schema.Boolean.annotate({
      title: 'Link Previews',
      defaultNote: 'false',
      description:
        "Draws a card under the bubble for each web address its text holds: the page's title, description, site name and picture. The server reads the page once, when the record is stored, through the guarded outbound fetch — never for an address a reader sends, and never a private, loopback, link-local or metadata address, on the first request or on any redirect. A page is read once per address and remembered for 24 hours (a failure for one hour); the card is text, and its picture is served by the app, so the reader's browser never contacts the other site. An address not read yet draws no card.",
    })
  ),
} as const
