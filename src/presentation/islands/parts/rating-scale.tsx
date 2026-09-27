/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable unicorn/no-null --
   `null` is the value that CLEARS a column: it is SQL NULL on the wire, while
   `undefined` is dropped by JSON.stringify and reaches the endpoint as "leave
   this field alone". */

/* eslint-disable react-perf/jsx-no-new-function-as-prop --
   One handler per rank: each closes over the rank it writes. */

import {
  computeRatingGlyphClasses,
  computeRatingRowClasses,
  DEFAULT_RATING_MAX,
  ratingGlyphsFor,
} from '@/presentation/design/cell-affordances-default-classes'
import type { ReactElement } from 'react'

/**
 * The rating scale, as a radio group — ONE control for the two surfaces that
 * edit a `rating` column: the data table's live cell and the form.
 *
 * Choosing the CURRENT score clears the field — to `NULL`, never to `0`. `max`
 * emits `CHECK (col >= 1 AND col <= max)` and the rating schema declares no
 * `min`, so 0 is not a writable value: writing it is a constraint violation
 * dressed up as a clear.
 *
 * The glyphs stay monochrome: `style` selects a GLYPH (`stars` / `hearts` /
 * `circles`), never a hue. Tone comes from {@link computeRatingGlyphClasses}, the
 * same place the read-only renderer takes it, so a filled and an unfilled rank
 * differ in tone as well as in glyph.
 *
 * `w-fit` is load-bearing: without it the radiogroup stretches to its container
 * and swallows clicks across its whole width.
 */
export function RatingScale({
  value,
  label,
  max,
  style,
  commit,
}: {
  readonly value: unknown
  readonly label: string
  readonly max?: number
  readonly style?: string
  readonly commit: (next: number | null) => void
}): ReactElement {
  const ranks = max ?? DEFAULT_RATING_MAX
  const [filled, empty] = ratingGlyphsFor(style)
  const score = Number(value)
  const current = Number.isFinite(score) ? score : 0

  return (
    <span
      role="radiogroup"
      aria-label={label}
      className={`${computeRatingRowClasses()} w-fit`}
    >
      {Array.from({ length: ranks }, (_unused, index) => {
        const rank = index + 1
        const isFilled = rank <= current
        const choose = (): void => commit(rank === current ? null : rank)
        return (
          <span
            key={rank}
            role="radio"
            aria-checked={rank === current}
            aria-label={`${rank} of ${ranks}`}
            tabIndex={-1}
            data-rating-glyph
            data-filled={isFilled}
            className={`cursor-pointer leading-none ${computeRatingGlyphClasses({ filled: isFilled })}`}
            onClick={choose}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return
              e.preventDefault()
              choose()
            }}
          >
            {isFilled ? filled : empty}
          </span>
        )
      })}
    </span>
  )
}
