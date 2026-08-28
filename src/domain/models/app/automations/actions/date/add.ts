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
 * Date Add Action (type: date, operator: add)
 *
 * Shift an instant forward by a calendar duration.
 *
 * Output: `{ instant: string }` (ISO 8601, UTC).
 *
 * ── Why `timezone` matters here ─────────────────────────────────────────────
 *
 * Calendar arithmetic is NOT the same as adding milliseconds. Adding one day
 * across a DST boundary in `Europe/Paris` must land on the same wall-clock time
 * the next day — 23 or 25 hours later, not 24. The shift is therefore computed
 * in the given zone and converted back to an instant, rather than by adding a
 * fixed offset to the epoch. `timezone` defaults to UTC, where the distinction
 * collapses.
 *
 * Larger units are applied before smaller ones, so a month shift that would
 * overflow (31 January + 1 month) clamps to the last valid day of the target
 * month before the day/hour components are applied.
 */
export const DateAddActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('date'),
  operator: Schema.Literal('add'),
  props: Schema.Struct({
    /** The instant to shift. */
    input: TemplateStringSchema.pipe(
      Schema.annotate({
        description:
          'Instant to shift: an ISO 8601 string or a template resolving to one ' +
          '(e.g. "{{trigger.record.createdAt}}")',
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
        // A shift of nothing is almost always a typo (a misspelled unit key is
        // dropped by the decoder), and silently returning the input unchanged
        // is the kind of no-op that only surfaces as wrong data downstream.
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
          : 'date:add requires at least one duration component (years, months, weeks, days, hours, minutes or seconds)'
      })
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'DateAddAction',
    title: 'Date Add Action',
    description: 'Shift an instant forward by a calendar duration, DST-correct in a given timezone',
  })
)

/** @public */
export type DateAddAction = Schema.Schema.Type<typeof DateAddActionSchema>
