/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { DataSourceSchema } from '../../data-source'
import { ComponentSizeSchema, ProgressVariantSchema } from '../../shared-schemas'
import { KPIAggregateSchema } from '../data/kpi/aggregate'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const ProgressTypeLiteral = Schema.Literal('progress')

/**
 * The bound bar's figure: the KPI ratio, two counts over one data source.
 *
 * A bar plots a share, so only `function: ratio` is accepted — a count, a sum
 * or an average has no maximum to fill a track against. The ratio's two sides
 * are counted on the progress bar's own `dataSource`, each narrowed by its own
 * filter, exactly as a ratio KPI counts them.
 */
export const ProgressAggregateSchema = KPIAggregateSchema.pipe(
  Schema.check(
    Schema.makeFilter((aggregate) =>
      aggregate.function === 'ratio'
        ? true
        : `a progress bar draws a share: kpiAggregate takes function: ratio, with a numerator and a denominator, not ${aggregate.function}`
    )
  )
)

export const progressFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  progressValue: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({ description: 'Current progress value (0 to progressMax)' }),
      Schema.check(Schema.isGreaterThanOrEqualTo(0))
    )
  ),
  progressMax: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({ description: 'Maximum progress value (default: 100)' }),
      Schema.check(Schema.isGreaterThan(0))
    )
  ),
  /**
   * Bind the bar to records instead of a written `progressValue`: the ratio
   * `kpiAggregate` counts both sides over this source. With `mine`, a side may
   * filter on the reader's own row (`{ field: <as>, operator: isNotEmpty }`),
   * so each reader sees her own progress. Refused beside `progressValue` or
   * `progressMax`, which would be a second answer to the same question.
   */
  dataSource: Schema.optional(
    DataSourceSchema.annotate({
      description:
        "Records the bar counts, instead of a written progressValue: kpiAggregate's numerator and denominator are both counted over them, after the reader's read rules. With `mine`, a side can filter on the reader's own row, so each reader sees her own progress. Not combined with progressValue or progressMax",
    })
  ),
  /**
   * The ratio drawn from `dataSource`. A denominator of zero draws an empty
   * bar and `0 of 0`, never a division error.
   */
  kpiAggregate: Schema.optional(
    ProgressAggregateSchema.annotate({
      description:
        'With dataSource, the share the bar fills: function: ratio, counting the records matching numerator.filter among those matching denominator.filter. A denominator of zero draws an empty bar, never an error',
    })
  ),
  /**
   * The text beside a bound bar, in place of the bare percentage.
   */
  labelTemplate: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Text shown beside a bound bar instead of the bare percentage. `{numerator}`, `{denominator}` and `{percent}` are replaced by the two counts and the rounded share. Accepts a `$t:` key',
        examples: ['{numerator} of {denominator} completed', '{percent}% done'],
      }),
      Schema.check(Schema.isMinLength(1))
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
    Schema.Array(
      Schema.String.annotate({ description: 'One step label, shown under its marker' }).pipe(
        Schema.check(Schema.isMinLength(1))
      )
    )
      .pipe(Schema.check(Schema.isMinLength(2)))
      .annotate({
        description:
          "Named steps for `progressVariant: 'steps'`, in order. At least two — one step is not a sequence. `progressValue` is then the 1-based current position.",
        examples: [['Account', 'Company', 'Billing', 'Review']],
      })
  ),
} as const
