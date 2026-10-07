/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `rating` SSR renderer — a row of stars that reads, or writes, one field.
 *
 * Bound to a record (a container repeated per row, a page bound to one
 * record), the data-source pass hands the field's raw value over as
 * `_recordValue`, as it does for `record-field`. The reading is ONE image named
 * "4 of 5": a screen reader hears the value, never a count of shapes.
 *
 * With `readOnly: false` it is an input — one native radio per rank under
 * `field`, so it submits a whole number with any form around it and the
 * browser's own radio-group keyboard (the arrows) moves the pick. A radio
 * group rather than a slider because each rank is a discrete, named choice and
 * "no rating yet" is a real state: a slider always holds a value.
 */

import {
  computeRatingGlyphClasses,
  computeRatingRankClasses,
  computeRatingRowClasses,
  DEFAULT_RATING_MAX,
  ratingGlyphsFor,
} from '@/presentation/design/cell-affordances-default-classes'
import { cn } from '@/presentation/design/class-merge'
import type { ComponentRenderer } from './component-dispatch-config'
import type { Tables } from '@/domain/models/app/tables'
import type { ReactElement } from 'react'

interface RatingRoot {
  readonly field?: string
  readonly max?: number
  readonly size?: 'sm' | 'md' | 'lg'
  readonly readOnly?: boolean
  readonly allowHalf?: boolean
}

const SIZE_CLASS = { sm: 'text-sm', md: 'text-base', lg: 'text-xl' } as const

/** The bound column's own `max` and glyph style, when the record names a table. */
function columnOf(
  tables: Tables | undefined,
  table: unknown,
  field: string | undefined
): { readonly max?: number; readonly style?: string } {
  const column = tables
    ?.find((candidate) => candidate.name === table)
    ?.fields.find((candidate) => candidate.name === field) as
    { readonly max?: number; readonly style?: string } | undefined
  return column ?? {}
}

/** The value as a reading: rounded to a whole star, or to a half with `allowHalf`. */
function readingOf(value: unknown, allowHalf: boolean): number | undefined {
  const score = typeof value === 'number' ? value : Number(value)
  if (value === null || value === undefined || value === '' || !Number.isFinite(score)) {
    return undefined
  }
  return allowHalf ? Math.round(score * 2) / 2 : Math.round(score)
}

/** One glyph of the reading: filled, hollow, or a hollow one half covered. */
function glyph(rank: number, score: number, glyphs: readonly [string, string]): ReactElement {
  const filled = rank <= score
  const half = !filled && rank - 0.5 === score
  return (
    <span
      key={rank}
      aria-hidden="true"
      data-rating-glyph=""
      data-filled={String(filled)}
      className={cn('relative inline-block', computeRatingGlyphClasses({ filled }))}
    >
      {filled ? glyphs[0] : glyphs[1]}
      {half && (
        <span
          className={cn(
            'absolute inset-y-0 left-0 w-1/2 overflow-hidden',
            computeRatingGlyphClasses({ filled: true })
          )}
        >
          {glyphs[0]}
        </span>
      )}
    </span>
  )
}

/** The stars as an input: one native radio per rank, submitted under `field`. */
function ratingInput(ctx: {
  readonly field: string
  readonly max: number
  readonly current: number
  readonly label: string
  readonly glyphs: readonly [string, string]
  readonly className: string
}): ReactElement {
  const { field, max, current, label, glyphs, className } = ctx
  return (
    <span
      role="radiogroup"
      aria-label={label}
      data-component-type="rating"
      className={cn(computeRatingRowClasses(), 'w-fit', className)}
    >
      {Array.from({ length: max }, (_unused, index) => {
        const rank = index + 1
        const filled = rank <= current
        return (
          <label
            key={rank}
            className={computeRatingRankClasses()}
          >
            <input
              type="radio"
              name={field}
              value={String(rank)}
              aria-label={`${rank} of ${max}`}
              defaultChecked={rank === current}
              className="absolute inset-0 m-0 cursor-pointer opacity-0"
            />
            <span
              aria-hidden="true"
              data-rating-glyph=""
              data-filled={String(filled)}
              className={computeRatingGlyphClasses({ filled })}
            >
              {filled ? glyphs[0] : glyphs[1]}
            </span>
          </label>
        )
      })}
    </span>
  )
}

/** The input's group name: the authored label, else the field. */
const groupLabel = (authored: unknown, field: string | undefined): string =>
  typeof authored === 'string' ? authored : (field ?? 'Rating')

/** The reading's accessible name. */
const readingLabel = (score: number | undefined, max: number): string =>
  score === undefined ? 'Not rated' : `${score} of ${max}`

export const ratingComponent: ComponentRenderer = ({
  component,
  rawProps,
  elementProps,
  tables,
}) => {
  const root = (component ?? {}) as RatingRoot
  const column = columnOf(tables, rawProps?.['_recordTable'], root.field)
  const max = root.max ?? column.max ?? DEFAULT_RATING_MAX
  const glyphs = ratingGlyphsFor(column.style)
  const value = rawProps?.['_recordValue']
  const className = cn(
    SIZE_CLASS[root.size ?? 'md'],
    elementProps['className'] as string | undefined
  )
  if (root.readOnly === false) {
    return ratingInput({
      field: root.field ?? 'rating',
      max,
      current: readingOf(value, false) ?? 0,
      label: groupLabel(elementProps['aria-label'], root.field),
      glyphs,
      className,
    })
  }
  const score = readingOf(value, root.allowHalf === true)
  return (
    <span
      role="img"
      aria-label={readingLabel(score, max)}
      data-component-type="rating"
      data-testid={elementProps['data-testid'] as string | undefined}
      className={cn(computeRatingRowClasses(), 'w-fit', className)}
    >
      {Array.from({ length: max }, (_unused, index) => glyph(index + 1, score ?? 0, glyphs))}
    </span>
  )
}
