/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionSchema } from '../../../action'


export const CalendarViewSchema = Schema.Literal('month', 'week', 'day').annotations({
  identifier: 'CalendarView',
  title: 'Calendar View',
  description: 'Calendar display mode: month grid, week view, or day view',
})


export const CalendarEventConfigSchema = Schema.Struct({
  onEventClick: Schema.optional(ActionSchema),
}).annotations({
  identifier: 'CalendarEventConfig',
  title: 'Calendar Event Config',
  description: 'Configuration for how events are displayed and interacted with on the calendar',
})


export const CalendarInteractionSchema = Schema.Struct({
  onDateClick: Schema.optional(ActionSchema),
  timeSlotInterval: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThan(0),
      Schema.annotations({
        description: 'Time slot interval in minutes for week/day views (default: 60)',
        examples: [15, 30, 60],
      })
    )
  ),
  showCurrentTimeIndicator: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Show a horizontal line at the current time in week/day views',
    })
  ),
}).annotations({
  identifier: 'CalendarInteraction',
  title: 'Calendar Interaction',
  description: 'Configuration for calendar user interactions (date clicks, drag, time slots)',
})


export type CalendarView = Schema.Schema.Type<typeof CalendarViewSchema>
export type CalendarEventConfig = Schema.Schema.Type<typeof CalendarEventConfigSchema>
export type CalendarInteraction = Schema.Schema.Type<typeof CalendarInteractionSchema>
