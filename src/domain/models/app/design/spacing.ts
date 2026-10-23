/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { DimensionValueSchema, ladderRecord } from './token-value-schemas'

/**
 * Step names a spacing ladder may not use, because the utility a step name
 * produces would collide with a display utility that already exists.
 *
 * A step's name becomes the suffix of every spacing utility, the logical sizes
 * among them. A step named after a display keyword therefore spells, as a
 * size utility, a class that already means something else — the inline-size
 * utility of a step named for the block display IS the inline-block display
 * class, so every inline-block element on the site would take that width. The
 * names are refused at the decode boundary, naming the step, rather than left
 * to change an unrelated utility silently.
 */
const RESERVED_SPACING_STEP_NAMES: ReadonlySet<string> = new Set([
  'block',
  'inline',
  'flex',
  'grid',
  'table',
  'hidden',
  'contents',
])

/** The refusal for a reserved step name, or `true` when the ladder has none. */
const refuseReservedStepNames = (entries: Readonly<Record<string, unknown>>): string | true => {
  const offender = Object.keys(entries).find((name) => RESERVED_SPACING_STEP_NAMES.has(name))
  if (offender === undefined) return true
  return `\`design.spacing\` declares the step '${offender}', a reserved name: a step's name becomes the suffix of every spacing utility, and '${offender}' would turn a display utility (such as \`inline-${offender}\`) into a size. Rename the step — any other name works.`
}

/**
 * The SPACE foundation: one ordered ladder of lengths.
 *
 * `design.spacing` is the single key for "how much room". Each step's NAME
 * becomes the suffix of every spacing utility — padding, margin, gap and the
 * rest — by way of the custom properties the generator emits for it.
 *
 * (The utility names are described rather than quoted on purpose: the CSS
 * candidate scanner harvests class-shaped literals out of `src/` comments, so
 * an example here would ship a live rule for a class no app uses.)
 *
 * ## What it consolidates
 *
 * Two earlier spellings of one ladder — the spacing block of the old `theme`
 * key, and `design.scales.spacing` — collapse here. Same values, same emission,
 * one name.
 *
 * ## The values were ALREADY lengths, and the record now says so
 *
 * A spacing record that accepted any string and then filtered for
 * `/^[0-9.]+(?:rem|px|em|%)$/` before emitting would let a value that is not a
 * length decode happily and reach nothing. Measured across every shipped
 * config, template and spec: no such value existed. Both
 * production apps hold a rem LENGTH LADDER on a 28px baseline.
 *
 * So the ladder value grammar (`px` or `rem`) is a tightening that refuses
 * nothing anybody wrote, and closes the silent-drop path that made the old
 * filter necessary. An author who wants named layout RECIPES — a class list
 * reused across containers — writes them as `props.className`, where they are
 * one node's business rather than a token the whole app inherits.
 */
export const DesignSpacingSchema = ladderRecord(
  DimensionValueSchema.pipe(
    Schema.annotate({
      title: 'Spacing Step',
      description: 'One rung of the spacing ladder, in `px` or `rem`',
      examples: ['0.25rem', '1px'],
    })
  ),
  'design.spacing',
  'Spacing Step',
  {
    keyExamples: ['0', 'px', '0-5', '4'],
    description:
      "The app's spacing ladder. Each step's name becomes the suffix of every spacing utility — padding, margin, gap and the rest.",
  }
).pipe(
  Schema.check(Schema.makeFilter(refuseReservedStepNames)),
  Schema.annotate({
    identifier: 'DesignSpacing',
    title: 'Spacing Ladder',
    description:
      "The app's spacing ladder. Each step's name becomes the suffix of every spacing utility — padding, margin, gap and the rest. A display keyword (`block`, `inline`, `flex`, `grid`, `table`, `hidden`, `contents`) is refused as a step name.",
    examples: [{ '0': '0px', px: '1px', '0-5': '0.125rem', '4': '1rem' }],
  })
)

/** @public */
export type DesignSpacing = Schema.Schema.Type<typeof DesignSpacingSchema>
