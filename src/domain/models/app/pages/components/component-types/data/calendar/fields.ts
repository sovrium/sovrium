/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { coreFields } from '../../modules/core'
import { dataBoundFields } from '../../modules/data-bound'
import { i18nFields } from '../../modules/i18n'
import { responsiveFields } from '../../modules/responsive'
import { visibilityFields } from '../../modules/visibility'
import { CalendarViewSchema, CalendarEventConfigSchema, CalendarInteractionSchema } from './schema'

export const CalendarTypeLiteral = Schema.Literal('calendar')

export const calendarFields = {
  ...coreFields,
  ...responsiveFields,
  ...visibilityFields,
  ...i18nFields,
  ...dataBoundFields,
  dateField: Schema.optional(
    Schema.String.annotate({ description: 'Date/datetime field for calendar event position' })
  ),
  endDateField: Schema.optional(
    Schema.String.annotate({ description: 'End date field for multi-day calendar events' })
  ),
  defaultView: Schema.optional(CalendarViewSchema),
  labelField: Schema.optional(
    Schema.String.annotate({ description: 'Field to use as event label on calendar' })
  ),
  /**
   * Field whose values colour each event.
   *
   * A calendar DERIVES a colour for a value whose option declares none, by
   * hashing the value onto a fixed fallback palette. A grid's `rowColorField`
   * does not — it fills only from a declared option colour. Both behaviours are
   * deliberate (a surface that painted before the option-colour amendment keeps
   * painting; one that never did does not start), and the difference used to be
   * stated nowhere, so an author naming one column on both surfaces got colour
   * in one and not the other with nothing to explain it.
   *
   * Two consequences of the hash worth knowing: the colour is a function of the
   * VALUE and not of the record set, so it is stable as rows come and go; and
   * distinct values can collide on one entry, so N values do not guarantee N
   * tones.
   */
  colorField: Schema.optional(
    Schema.String.annotate({
      description:
        'Field whose values colour each event. A value whose option declares no colour is given one from a fixed fallback palette, hashed from the value — unlike a table’s rowColorField, which fills only from declared option colours. The hash is stable per value and distinct values may collide.',
      examples: ['status', 'priority'],
    })
  ),
  maxEventsPerDay: Schema.optional(
    Schema.Finite.pipe(
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0)),
      Schema.annotate({ description: 'Max events visible per day cell before "+N more"' })
    )
  ),
  calendarEvent: Schema.optional(CalendarEventConfigSchema),
  calendarInteraction: Schema.optional(CalendarInteractionSchema),
} as const

// Re-export all sub-schemas
