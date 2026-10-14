/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { DEFAULT_RATING_MAX } from '@/presentation/design/cell-affordances-default-classes'
import {
  computeRatingClasses,
  computeRatingItemClasses,
} from '@/presentation/design/rating-default-classes'
import { RatingGlyph } from '@/presentation/design/rating-glyph'
import type { ReactElement } from 'react'

/** The arrows move the pick one rank, as in any radio group. */
const ARROW_STEP: Readonly<Record<string, number>> = {
  ArrowRight: 1,
  ArrowUp: 1,
  ArrowLeft: -1,
  ArrowDown: -1,
}

/**
 * One rank: the `rating-item` star wrapping its radio, named "n of max".
 * Choosing the current rank again clears the field.
 */
function RatingRank({
  rank,
  ranks,
  current,
  style,
  commit,
}: {
  readonly rank: number
  readonly ranks: number
  readonly current: number
  readonly style: string | undefined
  readonly commit: (next: number | null) => void
}): ReactElement {
  const isFilled = rank <= current
  const choose = (): void => commit(rank === current ? null : rank)
  return (
    <span
      data-slot="rating-item"
      data-state={isFilled ? 'on' : 'off'}
      className={computeRatingItemClasses()}
    >
      <span
        role="radio"
        aria-checked={rank === current}
        aria-label={`${rank} of ${ranks}`}
        tabIndex={rank === Math.max(current, 1) ? 0 : -1}
        data-rating-glyph
        data-filled={isFilled}
        className="focus-visible:ring-ring/50 inline-flex cursor-pointer rounded-sm leading-none outline-none focus-visible:ring-3"
        onClick={choose}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return
          e.preventDefault()
          choose()
        }}
      >
        <RatingGlyph
          style={style}
          filled={isFilled}
        />
      </span>
    </span>
  )
}

/**
 * The rating scale, as a radio group — ONE control for the two surfaces that
 * edit a `rating` column: the data table's live cell and the form.
 *
 * Choosing the CURRENT score clears the field — to `NULL`, never to `0`. `max`
 * emits `CHECK (col >= 1 AND col <= max)` and the rating schema declares no
 * `min`, so 0 is not a writable value: writing it is a constraint violation
 * dressed up as a clear.
 *
 * The parts are the `rating` component's (`rating`, `rating-item` with its
 * `data-state`), toned by the same recipe the server-drawn rating reads: an
 * earned star in the primary colour, an unearned one muted. `style` selects a
 * GLYPH (`stars` / `hearts` / `circles`), never a hue. Each star wraps its
 * radio, so the radio keeps its own role and name inside the part.
 *
 * `w-fit` (in the recipe) is load-bearing: without it the radiogroup stretches
 * to its container and swallows clicks across its whole width.
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
  const score = Number(value)
  const current = Number.isFinite(score) ? score : 0

  return (
    <span
      role="radiogroup"
      aria-label={label}
      data-slot="rating"
      className={`${computeRatingClasses()} text-xs tracking-[1px]`}
      onKeyDown={(e) => {
        const step = ARROW_STEP[e.key]
        if (step === undefined) return
        e.preventDefault()
        const next = Math.min(ranks, Math.max(1, current + step))
        commit(next)
        ;(e.currentTarget.children[next - 1]?.firstElementChild as HTMLElement | null)?.focus()
      }}
    >
      {Array.from({ length: ranks }, (_unused, index) => (
        <RatingRank
          key={index + 1}
          rank={index + 1}
          ranks={ranks}
          current={current}
          style={style}
          commit={commit}
        />
      ))}
    </span>
  )
}
