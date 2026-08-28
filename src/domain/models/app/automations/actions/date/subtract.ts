/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'
import { DurationProps, isValidTimezone, TimezoneProp } from './props'

/**
 * Date Subtract Action (type: date, operator: subtract)
 *
 * Shift an instant backward by a calendar duration. Same DST-correct zoned
 * arithmetic as `date:add`, with the sign flipped.
 *
 * Output: `{ instant: string }` (ISO 8601, UTC).
 *
 * ── Why this is not `add` with negative numbers ─────────────────────────────
 *
 * `add: { days: -7 }` is expressible, so this operator is redundant in the
 * strict sense. It exists anyway for two reasons that are about config authors
 * rather than about the engine:
 *
 *  - a leading `-` in YAML is easy to lose in review and easy to mistype as a
 *    list marker, and the failure is silent — the automation runs, just in the
 *    wrong direction.
 *  - the code being ported literally reads `subDays(...)`, and a one-to-one
 *    mapping is what keeps a migration reviewable.
 *
 * The duration components stay POSITIVE here and are subtracted. A negative
 * component is accepted and adds — the sign composes normally — but writing
 * `subtract: { days: -7 }` to mean "add 7 days" is discouraged.
 */
export const DateSubtractActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('date'),
  operator: Schema.Literal('subtract'),
  props: Schema.Struct({
    /** The instant to shift. */
    input: TemplateStringSchema.pipe(
      Schema.annotate({
        description:
          'Instant to shift: an ISO 8601 string or a template resolving to one ' +
          '(e.g. "{{trigger.record.dueDate}}")',
      })
    ),

    ...DurationProps,

    /** IANA timezone the calendar shift is computed in. Default UTC. */
    timezone: Schema.optional(
      TimezoneProp.pipe(
        Schema.annotate({
          description:
            'IANA timezone the calendar shift is computed in (e.g. "Europe/Paris"). Default "UTC". ' +
            'Determines DST behaviour for day-and-larger units.',
        })
      )
    ),
  }).pipe(
    Schema.check(
      Schema.makeFilter((props) => {
        if (props.timezone !== undefined && !isValidTimezone(props.timezone))
          return `Invalid IANA timezone: ${props.timezone}`
        const hasDuration = [
          props.years,
          props.months,
          props.weeks,
          props.days,
          props.hours,
          props.minutes,
          props.seconds,
        ].some((v) => v !== undefined)
        return hasDuration
          ? undefined
          : 'date:subtract requires at least one duration component (years, months, weeks, days, hours, minutes or seconds)'
      })
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'DateSubtractAction',
    title: 'Date Subtract Action',
    description:
      'Shift an instant backward by a calendar duration, DST-correct in a given timezone',
  })
)

/** @public */
export type DateSubtractAction = Schema.Schema.Type<typeof DateSubtractActionSchema>
