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
    Schema.String.annotations({ description: 'Date/datetime field for calendar event position' })
  ),
  endDateField: Schema.optional(
    Schema.String.annotations({ description: 'End date field for multi-day calendar events' })
  ),
  defaultView: Schema.optional(CalendarViewSchema),
  labelField: Schema.optional(
    Schema.String.annotations({ description: 'Field to use as event label on calendar' })
  ),
  colorField: Schema.optional(
    Schema.String.annotations({
      description: 'Field whose values map to colors (calendar events)',
    })
  ),
  maxEventsPerDay: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThan(0),
      Schema.annotations({ description: 'Max events visible per day cell before "+N more"' })
    )
  ),
  calendarEvent: Schema.optional(CalendarEventConfigSchema),
  calendarInteraction: Schema.optional(CalendarInteractionSchema),
} as const

export * from './schema'
