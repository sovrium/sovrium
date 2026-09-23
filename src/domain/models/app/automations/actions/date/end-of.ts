/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'
import { CalendarUnitProp, isValidTimezone, TimezoneProp } from './props'

/**
 * Date End-Of Action (type: date, operator: endOf)
 *
 * Snap an instant forward to the last representable moment of its enclosing
 * calendar unit.
 *
 * Output: `{ instant: string }` (ISO 8601, UTC).
 *
 * The boundary is INCLUSIVE and lands on `.999` milliseconds — the last instant
 * still inside the unit, not the first instant of the next one. That makes
 * `[startOf, endOf]` a closed range an author can hand straight to a record
 * filter with `lte`, which is how filters in this engine read. The alternative
 * (returning the next unit's start, for a half-open `lt` range) is defensible
 * in the abstract but would silently include the following unit for anyone who
 * reached for `lte`.
 *
 * Always used as a pair with `date:startOf`; see that operator for why the
 * timezone is the point.
 */
export const DateEndOfActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('date').pipe(
    Schema.annotate({
      description: "Constant value 'date' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('endOf').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'date' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    /** The instant to snap. */
    input: TemplateStringSchema.pipe(
      Schema.annotate({
        description:
          'Instant to snap: an ISO 8601 string or a template resolving to one ' +
          '(e.g. "{{trigger.record.createdAt}}")',
      })
    ),

    /** The unit whose end is taken. */
    unit: CalendarUnitProp.pipe(
      Schema.annotate({
        description:
          'Unit to snap to the end of (singular): year, month, week, day, hour, minute or ' +
          'second. Weeks end Sunday (ISO 8601). Inclusive — lands on .999ms.',
      })
    ),

    /** IANA timezone the boundary is computed in. Default UTC. */
    timezone: Schema.optional(
      TimezoneProp.pipe(
        Schema.annotate({
          description:
            'IANA timezone the boundary is computed in (e.g. "Europe/Paris"). Default "UTC". ' +
            'This is what makes "end of today" mean local 23:59:59.999 rather than UTC.',
        })
      )
    ),
  })
    .annotate({
      description: 'The date to round up, the unit to round to, and the time zone.',
    })
    .pipe(
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
    identifier: 'DateEndOfAction',
    title: 'Date End-Of Action',
    description:
      'Snap an instant forward to the inclusive end of its enclosing calendar unit in a timezone',
  })
)

/** @public */
export type DateEndOfAction = Schema.Schema.Type<typeof DateEndOfActionSchema>
