/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `aspect-ratio` — a box that holds ONE medium at a fixed width-to-height
 * ratio, whatever the screen. shadcn/ui's Aspect Ratio, under its own name.
 *
 * ## The ratio is required
 *
 * shadcn/ui's Aspect Ratio has no default ratio, and neither does this type: a
 * frame whose shape was guessed is a frame the author did not choose. It is
 * written the way a reader says it (`"16/9"`) or as a positive number (`1` for
 * a square, `0.75` for a portrait card).
 *
 * ## One child, and only a medium
 *
 * The frame is sized by its ratio, not by its content, so a second child has
 * nowhere to go and a text or a table — which reflow and grow — has no shape a
 * ratio can keep. `children` is injected by the component union like any
 * container's, so the "one medium" rule is a semantic check
 * (`component-children-validation.ts`) rather than a schema node here.
 *
 * Source: [internal ref]
 */

import { Schema } from 'effect'
import { coreFields } from '../modules/core'
import { responsiveFields } from '../modules/responsive'
import { visibilityFields } from '../modules/visibility'

export const AspectRatioTypeLiteral = Schema.Literal('aspect-ratio')

/** `"<width>/<height>"`, each a positive number, spaces around the slash allowed. */
const RATIO_PATTERN = /^\s*\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?\s*$/

/** The two spellings of a ratio: the fraction a reader says, or the number it equals. */
export const AspectRatioValueSchema = Schema.Union([
  Schema.String.annotate({
    title: 'Ratio Fraction',
    description: 'Width over height, as "<width>/<height>", for example "16/9" or "4/3".',
  }).pipe(
    Schema.check(
      Schema.isPattern(RATIO_PATTERN, {
        message: 'A ratio is written "<width>/<height>", for example "16/9".',
      })
    ),
    Schema.check(
      Schema.makeFilter(
        (value: string) =>
          value.split('/').every((part) => Number(part) > 0) ||
          'Both sides of a ratio must be greater than 0.'
      )
    )
  ),
  Schema.Finite.annotate({
    title: 'Ratio Number',
    description: 'Width divided by height: 1 for a square, 0.75 for a portrait card.',
  }).pipe(Schema.check(Schema.isGreaterThan(0))),
]).annotate({
  title: 'Aspect Ratio',
  description:
    'Width over height, as "16/9" or as the positive number it equals (1 is a square). Required: there is no default shape. shadcn/ui\'s Aspect Ratio ratio.',
  examples: ['16/9', '4/3', 1],
})

export const aspectRatioFields = {
  ...coreFields,
  ...responsiveFields,
  ...visibilityFields,
  /** The shape of the frame. Required: shadcn/ui's Aspect Ratio has no default either. */
  ratio: AspectRatioValueSchema,
} as const
