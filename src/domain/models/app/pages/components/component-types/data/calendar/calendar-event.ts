/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * calendarEvent property for data-table sections with calendar layout
 *
 * Configures how records are displayed as calendar events, including
 * title, start/end fields, color field, and onEventClick action.
 *
 * This is a re-export for schema path consistency. The canonical definition
 * lives in the sections/calendar module.
 *
 * @see {@link CalendarEventConfigSchema} from `./calendar`
 */
export {
  CalendarEventConfigSchema as CalendarEventSchema,
  type CalendarEventConfig as CalendarEvent,
} from './schema'
