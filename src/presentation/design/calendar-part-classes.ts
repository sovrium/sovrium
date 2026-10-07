/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The author's classes for the pieces a calendar draws, sent to the calendar
 * island only when the calendar names one of them: `event` (an event's root),
 * `day` (a month cell), `dayNumber` (the number in it), `columnHeader` (a
 * weekday header) — joined onto FullCalendar's own class lists — and
 * `toolbar`, already merged over the toolbar's recipe on the server.
 */
export interface CalendarPartClasses {
  readonly event?: string
  readonly day?: string
  readonly dayNumber?: string
  readonly columnHeader?: string
  readonly toolbar?: string
}
