/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionSchema } from '../../../action'

// ---------------------------------------------------------------------------
// CalendarViewSchema
// ---------------------------------------------------------------------------

/**
 * Calendar view mode
 *
 * Controls the initial display of the calendar:
 * - `month`: Full month grid (default)
 * - `week`: 7-day week with time slots
 * - `day`: Single day with hourly time slots
 */
export const CalendarViewSchema = Schema.Literal('month', 'week', 'day').annotations({
  identifier: 'CalendarView',
  title: 'Calendar View',
  description: 'Calendar display mode: month grid, week view, or day view',
})

// ---------------------------------------------------------------------------
// CalendarEventConfigSchema
// ---------------------------------------------------------------------------

/**
 * Calendar event display configuration
 *
 * Controls how events are visually presented on the calendar grid.
 * The core date/label/color field mappings are top-level on ComponentSchema;
 * this schema holds additional event-specific rendering options.
 *
 * @example
 * ```yaml
 * calendarEvent:
 *   onEventClick:
 *     type: navigate
 *     path: /events/$record.id
 * ```
 */
export const CalendarEventConfigSchema = Schema.Struct({
  /** Action triggered when an event is clicked */
  onEventClick: Schema.optional(ActionSchema),
}).annotations({
  identifier: 'CalendarEventConfig',
  title: 'Calendar Event Config',
  description: 'Configuration for how events are displayed and interacted with on the calendar',
})

// ---------------------------------------------------------------------------
// CalendarInteractionSchema
// ---------------------------------------------------------------------------

/**
 * Calendar interaction configuration
 *
 * Controls user interactions beyond event clicks: clicking empty dates,
 * dragging events, time slot intervals, and current-time indicators.
 *
 * @example
 * ```yaml
 * calendarInteraction:
 *   onDateClick:
 *     type: crud
 *     operation: create
 *     table: events
 *   timeSlotInterval: 60
 *   showCurrentTimeIndicator: true
 * ```
 */
export const CalendarInteractionSchema = Schema.Struct({
  /** Action triggered when an empty date cell is clicked */
  onDateClick: Schema.optional(ActionSchema),
  /** Time slot interval in minutes for week/day views */
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
  /** Show a line at the current time in week/day views */
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

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

/** @public */
export type CalendarView = Schema.Schema.Type<typeof CalendarViewSchema>
/** @public */
export type CalendarEventConfig = Schema.Schema.Type<typeof CalendarEventConfigSchema>
/** @public */
export type CalendarInteraction = Schema.Schema.Type<typeof CalendarInteractionSchema>
