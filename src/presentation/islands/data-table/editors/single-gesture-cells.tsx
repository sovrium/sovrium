/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable unicorn/no-null --
   `null` is the value that CLEARS a column: it is SQL NULL on the wire, while
   `undefined` is dropped by JSON.stringify and reaches the endpoint as "leave
   this field alone". The two are not interchangeable here — swapping them turns
   every clear gesture into a silent no-op. */

/* eslint-disable react-perf/jsx-no-new-function-as-prop --
   Cell-level controls: one per editable cell, and each handler closes over that
   cell's current value and commit callback. */

import { computeTableCheckboxControlClasses } from '@/presentation/design/table-default-classes'
import {
  computeRatingGlyphClasses,
  computeRatingRowClasses,
} from '../../../design/cell-affordances-default-classes'
import {
  DEFAULT_RATING_MAX,
  ratingGlyphsFor,
  readsAsTrue,
} from '../../runtime/cell-value-semantics'
import type { FieldMeta, FieldWriteValue } from '../../hooks/use-inline-editing'
import type { ReactElement } from 'react'

/**
 * The two controls that commit on ONE click, with no editor to open first.
 *
 * A checkbox and a rating are single-gesture edits. Requiring a double-click to
 * open and then a click to act is two gestures to change one bit, and it is not
 * what either control looks like it wants. So they are rendered by the READ
 * path — the cell shows the live control instead of a picture of its value —
 * and there is no editing state around them at all.
 *
 * That is only safe because the row-click guard now keys on the same condition
 * that makes a row clickable (`hasRowAction || selectionMode === 'single'`)
 * rather than on the row action alone. Before that widening, ticking a checkbox
 * in a single-selection grid would also have selected its row.
 */

export function CheckboxCellControl({
  value,
  label,
  commit,
}: {
  readonly value: unknown
  readonly label: string
  readonly commit: (next: FieldWriteValue) => void
}): ReactElement {
  const checked = readsAsTrue(value)
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      onChange={() => commit(!checked)}
      className={computeTableCheckboxControlClasses({ interactive: true })}
    />
  )
}

/**
 * The rating scale, as a radio group.
 *
 * Clicking the CURRENT score clears the field — to `NULL`, never to `0`. `max`
 * emits `CHECK (col >= 1 AND col <= max)` and `RatingFieldSchema` declares no
 * `min`, so 0 is not a writable value: writing it is a constraint violation
 * dressed up as a clear.
 *
 * The glyphs stay monochrome. `RatingFieldSchema` has `max` and `style`, and
 * `style` selects a GLYPH (`stars` / `hearts` / `circles`) — never a hue
 * ([internal ref] A7). A multi-select chip carries the author's declared colour
 * because that vocabulary is the author's; a rating scale has no such
 * vocabulary to carry.
 *
 * Monochrome is not the same as untoned, and this control used to confuse the
 * two. It carried no tone at all, so an unearned point painted at full ink and
 * the scale said its score in the GLYPH alone — where the read-only renderer
 * next door says it twice, in the glyph and in the tone. A reader who cannot
 * separate a solid star from a hollow one at 11px got no second signal, and the
 * same rating drew differently depending only on whether its column happened to
 * be editable. Both paths now take their glyph tone from
 * {@link computeRatingGlyphClasses}, so there is one place the empty arm is
 * decided.
 *
 * The same divergence survived one step up, in the ROW, and the tone fix made
 * it easier to see rather than harder: measured, the read path's glyphs were
 * 11px on 1px of tracking while these inherited the cell's 12px at
 * `letter-spacing: normal`. So an editable rating was a type step larger and a
 * hair tighter than the identical value one column over — a difference that
 * says something about the column's writability, which is not a thing a SCORE
 * should be reporting. The row now delegates to
 * {@link computeRatingRowClasses} too, and the two paths differ in exactly one
 * class.
 *
 * That one class is `w-fit`, and it is load-bearing: without it the radiogroup
 * stretches to the cell and swallows clicks across its whole width, so a reader
 * aiming at nothing in particular still writes a score.
 */
export function RatingCellControl({
  value,
  label,
  fieldMeta,
  commit,
}: {
  readonly value: unknown
  readonly label: string
  readonly fieldMeta: FieldMeta | undefined
  readonly commit: (next: FieldWriteValue) => void
}): ReactElement {
  const max = fieldMeta?.display?.max ?? DEFAULT_RATING_MAX
  const [filled, empty] = ratingGlyphsFor(fieldMeta?.display?.style)
  const score = Number(value)
  const current = Number.isFinite(score) ? score : 0

  return (
    <span
      role="radiogroup"
      aria-label={label}
      className={`${computeRatingRowClasses()} w-fit`}
    >
      {Array.from({ length: max }, (_unused, index) => {
        const rank = index + 1
        const isFilled = rank <= current
        return (
          <span
            key={rank}
            role="radio"
            aria-checked={rank === current}
            aria-label={`${rank} of ${max}`}
            tabIndex={-1}
            data-rating-glyph
            data-filled={isFilled}
            className={`cursor-pointer leading-none ${computeRatingGlyphClasses({ filled: isFilled })}`}
            onClick={() => commit(rank === current ? null : rank)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return
              e.preventDefault()
              commit(rank === current ? null : rank)
            }}
          >
            {isFilled ? filled : empty}
          </span>
        )
      })}
    </span>
  )
}
