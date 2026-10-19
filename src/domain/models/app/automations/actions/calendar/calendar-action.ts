/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { CalendarImportIcsActionSchema } from './import-ics'

/**
 * Calendar Action — union of all calendar operators
 */
export const CalendarActionSchema = Schema.Union([CalendarImportIcsActionSchema]).pipe(
  Schema.annotate({
    identifier: 'CalendarAction',
    title: 'Calendar Action',
    description:
      'Calendar operations: importing the events of an iCalendar (`.ics`) feed into a table',
  })
)

/** @public */
export type CalendarAction = Schema.Schema.Type<typeof CalendarActionSchema>
