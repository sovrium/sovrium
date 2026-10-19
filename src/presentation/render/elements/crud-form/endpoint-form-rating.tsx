/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `rating` control of an endpoint-bound form: a scale of `max` ranks
 * (5 when the field names none) the reader picks from, drawn the way the
 * `rating` component draws its input — a radio group named by the field's
 * label, one native radio per rank named "n of max", laid over the same glyph.
 * The fill follows the checked radio from CSS alone, so nothing repaints it.
 *
 * It is not a `<label>`-wrapped control like the others: a label names ONE
 * control, and a scale is a group of them, so the label is drawn above the
 * group and names it (`aria-label`), which is also where the reason a refused
 * scale is given reads the field's name. The endpoint runtime sends the rank
 * picked as a number (`islands/runtime/endpoint-form-runtime.ts`), and a
 * `required` scale is checked once, as one field, before the form sends
 * (`islands/runtime/endpoint-form-validation.ts`).
 */

import { type ReactElement } from 'react'
import { DEFAULT_RATING_MAX } from '@/presentation/design/cell-affordances-default-classes'
import { fieldDescriptionId } from '@/presentation/design/field-display'
import {
  computeFormFieldClasses,
  computeFormFieldLabelClasses,
} from '@/presentation/design/form-layout-classes'
import {
  computeRatingClasses,
  computeRatingRankClasses,
} from '@/presentation/design/rating-default-classes'
import { RatingGlyph } from '@/presentation/design/rating-glyph'
import type { FormFieldConfig } from '@/domain/models/app/pages/components/component-types/data/form'

/** One rank of the scale: a transparent native radio laid over its glyph. */
function renderRank(
  field: FormFieldConfig,
  rank: number,
  ranks: number,
  current: number
): ReactElement {
  return (
    <label
      key={rank}
      data-slot="rating-item"
      className={computeRatingRankClasses()}
    >
      <input
        type="radio"
        name={field.field}
        value={String(rank)}
        {...(field.required === true && { required: true })}
        aria-label={`${rank} of ${ranks}`}
        defaultChecked={rank === current}
        className="absolute inset-0 m-0 cursor-pointer opacity-0"
      />
      <span
        aria-hidden="true"
        data-rating-glyph=""
        className="inline-flex"
      >
        <RatingGlyph style={undefined} />
      </span>
    </label>
  )
}

/** The rank a field opens on: its numeric `defaultValue`, else none (0). */
function openingRank(field: FormFieldConfig): number {
  const score = Number(field.defaultValue)
  return typeof field.defaultValue === 'boolean' || !Number.isInteger(score) ? 0 : score
}

/**
 * A `rating` field of an endpoint form: its label above a radio group of
 * `max` ranks it names, opening on its `defaultValue`, with its description
 * through `aria-describedby`.
 */
export function renderEndpointRatingField(field: FormFieldConfig): ReactElement {
  const ranks = field.max ?? DEFAULT_RATING_MAX
  const current = openingRank(field)
  const label = field.label ?? field.field
  return (
    <div
      key={field.field}
      className={computeFormFieldClasses()}
    >
      <span className={computeFormFieldLabelClasses()}>{label}</span>
      <span
        role="radiogroup"
        aria-label={label}
        {...(field.required === true && { 'aria-required': 'true' })}
        {...(field.description !== undefined && {
          'aria-describedby': fieldDescriptionId(field.field),
        })}
        data-rating-scale="true"
        data-slot="rating"
        className={computeRatingClasses()}
      >
        {Array.from({ length: ranks }, (_unused, index) =>
          renderRank(field, index + 1, ranks, current)
        )}
      </span>
    </div>
  )
}
