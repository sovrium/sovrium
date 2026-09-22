/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ComponentSizeSchema, ProgressVariantSchema } from '../../shared-schemas'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const ProgressTypeLiteral = Schema.Literal('progress')

export const progressFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  progressValue: Schema.optional(
    Schema.Finite.pipe(
      Schema.check(Schema.isGreaterThanOrEqualTo(0)),
      Schema.annotate({ description: 'Current progress value (0 to progressMax)' })
    )
  ),
  progressMax: Schema.optional(
    Schema.Finite.pipe(
      Schema.check(Schema.isGreaterThan(0)),
      Schema.annotate({ description: 'Maximum progress value (default: 100)' })
    )
  ),
  showLabel: Schema.optional(
    Schema.Boolean.annotate({ description: 'Display progress percentage label' })
  ),
  size: Schema.optional(ComponentSizeSchema),
  progressVariant: Schema.optional(ProgressVariantSchema),
  /**
   * The named steps a `progressVariant: 'steps'` rail draws, in order.
   *
   * Only meaningful for that variant: a bar and a circle plot a ratio and have
   * nothing to label. With it, `progressValue` stops being a percentage and
   * becomes the 1-based position — `2` of four steps is the second, not 2%.
   *
   * A rail with no `steps` is refused rather than drawn empty, because the
   * labels ARE the rail: an unlabelled sequence of four dots tells a reader
   * how many stages there are and nothing about what any of them is.
   */
  steps: Schema.optional(
    Schema.Array(Schema.String.pipe(Schema.check(Schema.isMinLength(1))))
      .pipe(Schema.check(Schema.isMinLength(2)))
      .annotate({
        description:
          "Named steps for `progressVariant: 'steps'`, in order. At least two — one step is not a sequence. `progressValue` is then the 1-based current position.",
        examples: [['Account', 'Company', 'Billing', 'Review']],
      })
  ),
} as const
