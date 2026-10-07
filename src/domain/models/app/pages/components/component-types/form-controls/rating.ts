/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `rating` — a row of stars that reads, and optionally writes, a `rating`
 * field.
 *
 * ─── ONE TYPE FOR THE INPUT AND THE DISPLAY ───────────────────────────────
 *
 * The same stars are an input inside a form and a reading on a record page;
 * `readOnly` is the only difference, so they are one type. Inside a record
 * context (`$record`) the component reads `field` from the bound record; inside
 * a `form` it submits under `field`.
 *
 * ─── WHY HALVES ARE DISPLAY-ONLY ──────────────────────────────────────────
 *
 * A `rating` column stores a whole number, so the input only ever offers whole
 * stars. A half star is still a true reading of an AVERAGE (a rollup of
 * ratings), which is the one place `allowHalf` changes anything: it rounds the
 * displayed value to the nearest half instead of the nearest whole, and it is
 * inert on an input.
 */

import { Schema } from 'effect'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const RatingTypeLiteral = Schema.Literal('rating')

export const ratingFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  field: Schema.String.pipe(
    Schema.annotate({
      description:
        'The rating (or numeric) field the stars read from the bound record, and submit under inside a form',
      examples: ['rating', 'satisfaction'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
  max: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        description:
          'Number of stars (default: the field’s own `max`, else 5). From 1 to 10, the range a rating field stores.',
        examples: [5, 10],
      }),
      Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 10 }))
    )
  ),
  size: Schema.optional(
    Schema.Literals(['sm', 'md', 'lg']).annotate({
      description: 'Size of each star: sm, md (default) or lg',
    })
  ),
  readOnly: Schema.optional(
    Schema.Boolean.annotate({
      description:
        'Draw the stars as a reading rather than an input (default: false inside a form, true elsewhere)',
    })
  ),
  allowHalf: Schema.optional(
    Schema.Boolean.annotate({
      description:
        'Round a read-only value to the nearest half star instead of the nearest whole one, for averages. Inert on an input, which always takes whole stars.',
    })
  ),
} as const
