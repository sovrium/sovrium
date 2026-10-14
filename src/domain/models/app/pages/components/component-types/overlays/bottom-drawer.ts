/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `drawer` — a panel that rises from the bottom edge and is dragged down to
 * dismiss. shadcn/ui's Drawer, under its own name, on Base UI's Drawer.
 *
 * ## The side panel's keys are refused
 *
 * The panel that slides in from a side edge is `sheet`. Every key of that
 * panel is refused on this type with a sentence naming `sheet`
 * (`repurposed-removed-keys.ts`), so a config written for the old meaning is
 * stopped at validation rather than drawn as something else.
 *
 * ## Opened as a dialog is
 *
 * The panel carries its id in `props.id` and a trigger names it, exactly as a
 * `dialog` is opened. `title` and `description` name and describe it.
 *
 * Source: [internal ref]
 */

import { Schema } from 'effect'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const BottomDrawerTypeLiteral = Schema.Literal('drawer')

/** One resting height, as a fraction of the screen height. */
const SnapPointSchema = Schema.Finite.annotate({
  description: 'A resting height as a fraction of the screen: 0.4 is 40 %, 1 is full height.',
}).pipe(Schema.check(Schema.isGreaterThan(0)), Schema.check(Schema.isLessThanOrEqualTo(1)))

/** The resting heights, ascending. */
export const DrawerSnapPointsSchema = Schema.Array(SnapPointSchema)
  .annotate({
    title: 'Snap Points',
    description:
      "The heights the panel rests at, as ascending fractions of the screen between 0 and 1 (for example [0.4, 1]). It opens at the first; a drag moves it to the next. shadcn/ui's Drawer snapPoints.",
    examples: [[0.4, 1]],
  })
  .pipe(
    Schema.check(Schema.isMinLength(1)),
    Schema.check(
      Schema.makeFilter(
        (points: readonly number[]) =>
          points.every((point, index) => index === 0 || point > (points[index - 1] ?? 0)) ||
          'snapPoints must be in ascending order, each between 0 and 1.'
      )
    )
  )

export const bottomDrawerFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  title: Schema.optional(
    Schema.String.annotate({
      title: 'Title',
      description: 'Names the panel, in its header. A `$t:` key is translated.',
    })
  ),
  description: Schema.optional(
    Schema.String.annotate({
      title: 'Description',
      description: 'Describes the panel, under the title. A `$t:` key is translated.',
    })
  ),
  side: Schema.optional(
    Schema.Literals(['bottom', 'top']).annotate({
      title: 'Side',
      defaultNote: 'bottom',
      description:
        "The edge the panel comes from: 'bottom' (dragged down to dismiss) or 'top' (dragged up). A panel from a side edge is a `sheet`.",
    })
  ),
  snapPoints: Schema.optional(DrawerSnapPointsSchema),
  handle: Schema.optional(
    Schema.Boolean.annotate({
      title: 'Handle',
      defaultNote: 'true',
      description: 'Draws the grip the panel is dragged by.',
    })
  ),
  modal: Schema.optional(
    Schema.Boolean.annotate({
      title: 'Modal',
      defaultNote: 'true',
      description:
        'true dims the page and keeps the focus in the panel; false leaves the page behind usable.',
    })
  ),
  swipeToDismiss: Schema.optional(
    Schema.Boolean.annotate({
      title: 'Swipe To Dismiss',
      defaultNote: 'true',
      description:
        'A drag toward the edge closes the panel. false keeps it open after a drag; Escape and the overlay still close it.',
    })
  ),
} as const
