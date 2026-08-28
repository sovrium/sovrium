/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'
import { DiffUnitProp, isValidTimezone, TimezoneProp } from './props'

/**
 * Date Diff Action (type: date, operator: diff)
 *
 * Measure the distance between two instants in a chosen unit.
 *
 * Output: `{ value: number }` — signed, `to` minus `from`, so a `to` earlier
 * than `from` yields a negative value rather than an absolute distance. An
 * automation deciding "is this overdue" needs the sign; one that wants
 * magnitude can take the absolute value downstream, whereas a lost sign cannot
 * be recovered.
 *
 * Truncated toward zero: 47 hours in `day` is `1`, not `1.958` and not `2`.
 * Rounding is left to the author because the right rule is domain-specific —
 * an SLA counts elapsed whole days, a report may want the ceiling.
 *
 * ── Why the calendar units need a timezone ──────────────────────────────────
 *
 * `day` and larger are CALENDAR units, so their boundaries depend on a zone:
 * the number of days between two instants differs depending on where midnight
 * falls, and a DST transition makes a "day" 23 or 25 hours long. `hour` and
 * below are fixed-length and ignore the zone entirely.
 *
 * Comparison predicates (`isBefore`, `isAfter`, `isBetween`) are deliberately
 * NOT operators here. A predicate belongs in `filter`/`continue` and
 * `ConditionGroupSchema` where the rest of the engine's conditions live; a
 * `diff` sign already answers the same question for authors who want it as
 * data. Two places to express one predicate is worse than one place.
 */
export const DateDiffActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('date'),
  operator: Schema.Literal('diff'),
  props: Schema.Struct({
    /** The earlier end of the interval (the subtrahend). */
    from: TemplateStringSchema.pipe(
      Schema.annotate({
        description:
          'Start instant: an ISO 8601 string or a template resolving to one. Subtracted FROM `to`.',
      })
    ),

    /** The later end of the interval (the minuend). */
    to: TemplateStringSchema.pipe(
      Schema.annotate({
        description: 'End instant: an ISO 8601 string or a template resolving to one',
      })
    ),

    /** Unit the answer is expressed in. */
    unit: DiffUnitProp,

    /** IANA timezone for calendar-unit boundaries (`day` and larger). Default UTC. */
    timezone: Schema.optional(
      TimezoneProp.pipe(
        Schema.annotate({
          description:
            'IANA timezone used for calendar-unit boundaries (day and larger). Default "UTC". ' +
            'Ignored for hour, minute, second and millisecond, which are fixed-length.',
        })
      )
    ),
  }).pipe(
    Schema.check(
      Schema.makeFilter(({ timezone }) =>
        timezone !== undefined && !isValidTimezone(timezone)
          ? `Invalid IANA timezone: ${timezone}`
          : undefined
      )
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'DateDiffAction',
    title: 'Date Diff Action',
    description: 'Measure the signed distance between two instants in a chosen unit',
  })
)

/** @public */
export type DateDiffAction = Schema.Schema.Type<typeof DateDiffActionSchema>
