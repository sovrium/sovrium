/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  asComponent,
  DATA_NOTE,
  panel,
  panelHead,
  param,
  PLACE_NOTE,
  stack,
  stringParam,
  THEME_NOTE,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** The records of one of your tables drawn as time blocks on a week grid. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'calendar-week',
  title: 'Week calendar',
  category: 'application',
  tags: ['calendar', 'week', 'bookings', 'schedule', 'time slots'],
  description:
    'A week grid in half-hour slots drawing the records of one of your tables as blocks from their start to their end time, with a line at the current time.',
  notes: [PLACE_NOTE, DATA_NOTE, THEME_NOTE],
  params: [
    stringParam('headline', 'The heading above the calendar. Empty to omit.', '[This week]'),
    stringParam('table', 'The table the bookings are read from.', 'bookings'),
    stringParam('startField', 'The date-and-time field where each block starts.', 'starts_at'),
    stringParam('endField', 'The date-and-time field where each block ends.', 'ends_at'),
    stringParam('labelField', 'The text field drawn on each block.', 'title'),
  ],
  tables: [
    {
      param: 'table',
      fields: [
        { name: 'starts_at', param: 'startField', type: 'datetime' },
        { name: 'ends_at', param: 'endField', type: 'datetime' },
        { name: 'title', param: 'labelField', type: 'single-line-text' },
      ],
    },
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(
      name,
      panel([
        stack(
          [
            ...(p('headline') === '' ? [] : [panelHead(p('headline'))]),
            {
              type: 'calendar',
              dataSource: { table: p('table') },
              dateField: p('startField'),
              endDateField: p('endField'),
              labelField: p('labelField'),
              defaultView: 'week',
              calendarInteraction: { timeSlotInterval: 30, showCurrentTimeIndicator: true },
            },
          ],
          'gap-4'
        ),
      ])
    )
  },
})
