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
 * Date Start-Of Action (type: date, operator: startOf)
 *
 * Snap an instant back to the start of its enclosing calendar unit.
 *
 * Output: `{ instant: string }` (ISO 8601, UTC).
 *
 * ── Why this is the operator that makes zone support pay off ────────────────
 *
 * "Everything created today" is the single most common reporting filter, and it
 * is wrong in UTC for every user who is not in UTC: for a Paris team, midnight
 * UTC is 01:00 or 02:00 local, so an hour or two of "yesterday" lands in
 * today's report every single day. Snapping in `Europe/Paris` and converting
 * back to an instant is what makes the boundary mean what the reader thinks it
 * means.
 *
 * Always used as a pair with `date:endOf` — a half-open range `[startOf,
 * endOf]` is the shape a record filter consumes.
 *
 * `week` starts on Monday (ISO 8601). This is fixed rather than configurable:
 * a `weekStartsOn` prop would be a second place to encode a locale convention
 * that `locale` already implies, and the ISO answer is the one a business
 * report wants.
 */
export const DateStartOfActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('date').pipe(
    Schema.annotate({
      description: "Constant value 'date' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('startOf').pipe(
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

    /** The unit whose start is taken. */
    unit: CalendarUnitProp.pipe(
      Schema.annotate({
        description:
          'Unit to snap to the start of (singular): year, month, week, day, hour, minute or ' +
          'second. Weeks start Monday (ISO 8601).',
      })
    ),

    /** IANA timezone the boundary is computed in. Default UTC. */
    timezone: Schema.optional(
      TimezoneProp.pipe(
        Schema.annotate({
          description:
            'IANA timezone the boundary is computed in (e.g. "Europe/Paris"). Default "UTC". ' +
            'This is what makes "start of today" mean local midnight rather than UTC midnight.',
        })
      )
    ),
  })
    .annotate({
      description: 'The date to round down, the unit to round to, and the time zone.',
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
    identifier: 'DateStartOfAction',
    title: 'Date Start-Of Action',
    description: 'Snap an instant back to the start of its enclosing calendar unit in a timezone',
  })
)

/** @public */
export type DateStartOfAction = Schema.Schema.Type<typeof DateStartOfActionSchema>
