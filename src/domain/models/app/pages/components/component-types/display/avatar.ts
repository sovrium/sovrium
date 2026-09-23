/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `avatar` — a person or a record as a picture, initials, or a group of them.
 *
 * ## Why it is one type and not three
 *
 * A single avatar, an avatar with a presence dot, and a stack of overlapping
 * avatars with a `+N` overflow are the same element drawn three ways: a round
 * box carrying an identity, sized from one ladder. Splitting them would give
 * three types that share every token, every size and every fallback rule, and
 * would force an author who adds a second person to a row to change the type
 * rather than add an item.
 *
 * ## The fallback chain is ordered, and the order is the whole feature
 *
 * `src` → `initials` → initials derived from `label` → an empty disc. Each rung
 * exists because the one above it can be absent at RENDER time rather than at
 * decode time: a record's photo column is null for most rows, and a name column
 * is not. An author binding `src: '$record.photo'` therefore gets a readable
 * initial rather than a broken image, without writing the fallback themselves.
 *
 * Deriving from `label` is the rung that earns the type its place over a bare
 * `image`: "Ada Lovelace" → "AL" is one line here and a formula in a config.
 *
 * ## `items` makes it a group, and the single-avatar keys go inert
 *
 * Declaring `items` draws the stack; `src`, `initials`, `alt` and `status` are
 * then read from each item rather than from the component, and the top-level
 * ones are ignored. That is INERT rather than refused, following the rule the
 * catalogue reshape settled on (`component-xor-rules.ts`): a refusal is for a
 * key whose presence makes an author's WORK vanish — authored `children` under
 * a record binding — not for a key that merely goes unread. Nothing an author
 * wrote is lost here; one avatar's props are simply not what a group draws.
 *
 * `label` is the exception: on a group it names the group for a screen reader,
 * because a stack of four discs is one thing to a reader and four to the DOM.
 *
 * ## Sizes are a three-rung ladder, not a free length
 *
 * `sm` 24px, `md` 32px, `lg` 40px — the three the canvas draws. A free pixel
 * value was considered and refused: the status dot, the overlap offset and the
 * initials type step are all derived from the box, so an arbitrary size makes
 * every one of them a rounding decision the author never sees. A fourth rung is
 * a one-line addition here; an arbitrary length is a permanent one.
 *
 * Source: [internal ref]
 * Specs: [internal ref] … 007, plus this type's own REGRESSION rollup
 */

import { Schema } from 'effect'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const AvatarTypeLiteral = Schema.Literal('avatar')

/** The three box sizes an avatar draws at. */
export const AvatarSizeSchema = Schema.Literals(['sm', 'md', 'lg']).annotate({
  title: 'Avatar Size',
  description:
    'Box size: `sm` 24px, `md` 32px (default), `lg` 40px. The status dot, the group overlap and the initials type step are all derived from it.',
})

/**
 * Presence, drawn as a dot on the lower-right corner.
 *
 * Four states rather than a boolean because "away" and "busy" are the two a
 * reader actually acts on differently, and a boolean would push them into a
 * second field that has to be read against the first.
 */
export const AvatarStatusSchema = Schema.Literals(['online', 'away', 'busy', 'offline']).annotate({
  title: 'Presence',
  description:
    'Presence dot drawn on the lower-right corner. Omit to draw no dot at all — `offline` draws a muted dot, which is not the same statement as saying nothing.',
})

/** One member of a group stack. */
const AvatarItemSchema = Schema.Struct({
  src: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        title: 'Image',
        description: 'Picture for this member. Falls back to `initials`, then to `label`.',
        examples: ['/uploads/ada.avif', '$record.photo'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  initials: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        title: 'Initials',
        description: 'Letters to draw when there is no picture. Derived from `label` if omitted.',
        examples: ['AL'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  label: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        title: 'Name',
        description: 'Who this is. Becomes the accessible name and the source of derived initials.',
        examples: ['Ada Lovelace', '$record.name'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  status: Schema.optional(AvatarStatusSchema),
}).annotate({
  identifier: 'AvatarItem',
  title: 'Avatar Item',
  description: 'One member of a group stack',
})

export const avatarFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  /** Picture to draw. First rung of the fallback chain. */
  src: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        title: 'Image',
        description:
          'Picture to draw. Falls back to `initials`, then to initials derived from `label`, then to an empty disc — so a null photo column renders a readable avatar rather than a broken image.',
        examples: ['/uploads/ada.avif', '$record.photo'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  /**
   * Alternative text for the picture.
   *
   * Separate from `label` because they answer different questions: `alt`
   * describes the IMAGE ("Ada at the 2026 offsite"), `label` names the person.
   * When only `label` is given it serves as both, which is right far more often
   * than it is wrong; declaring `alt` is how an author says otherwise.
   */
  alt: Schema.optional(
    Schema.String.annotate({
      defaultNote: 'the value of `label`',
      description:
        'Alternative text for the picture. Defaults to `label`. Set it empty to mark a purely decorative avatar.',
    })
  ),
  /** Letters to draw when there is no picture. */
  initials: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        title: 'Initials',
        description:
          'Letters to draw when there is no picture. Derived from `label` when omitted — the first letter of each of its first two words.',
        examples: ['AL'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  /** Who or what this avatar stands for. */
  label: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        title: 'Name',
        description:
          'Who or what this avatar stands for. Becomes the accessible name, the source of derived initials, and — on a group — the name of the stack as a whole.',
        examples: ['Ada Lovelace', '$record.owner'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  size: Schema.optional(AvatarSizeSchema),
  /**
   * Corner shape.
   *
   * `square` is not a rectangle: it keeps the same box and softens the corners
   * to the design's radius, so a row of mixed shapes still aligns.
   */
  shape: Schema.optional(
    Schema.Literals(['circle', 'square']).annotate({
      title: 'Shape',
      description:
        'Corner shape. `circle` (default) for people, `square` for a record or an organisation — the same box, rounded to the design radius rather than fully.',
    })
  ),
  status: Schema.optional(AvatarStatusSchema),
  /**
   * The members of a group stack. Declaring it makes this a group.
   *
   * The single-avatar keys above are then read per item and the top-level ones
   * go unread — see the module docstring for why that is inert rather than
   * refused.
   */
  items: Schema.optional(
    Schema.Array(AvatarItemSchema)
      .pipe(Schema.check(Schema.isMinLength(1)))
      .annotate({
        title: 'Group',
        description:
          'Members of an overlapping stack. Present ⇒ this is a group: `src`, `initials`, `alt` and `status` are read per item instead of from the component, and `label` names the stack. At least one member — `items: []` says "this is a group" and then names nobody, which draws an empty box no reader can interpret.',
        examples: [[{ label: 'Ada Lovelace' }, { label: 'Grace Hopper' }]],
      })
  ),
  /**
   * How many members to draw before collapsing the rest into a `+N` disc.
   *
   * Omitted draws every member. The overflow disc counts what is HIDDEN, not
   * the total: a stack of six with `max: 3` reads `A G T +3`, which is the
   * arithmetic a reader does anyway.
   */
  max: Schema.optional(
    Schema.Finite.pipe(Schema.check(Schema.isInt(), Schema.isGreaterThan(0))).annotate({
      title: 'Visible Members',
      description:
        'How many group members to draw before the rest collapse into a `+N` disc. The disc counts the hidden members, not the total. Omit to draw every member.',
      examples: [3, 5],
    })
  ),
} as const
