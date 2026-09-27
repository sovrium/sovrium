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

/** The records of one of your tables placed on a month grid by their date. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'calendar-month',
  title: 'Month calendar',
  category: 'application',
  tags: ['calendar', 'month', 'events', 'schedule', 'dates'],
  description:
    'A month grid placing the records of one of your tables on the day their date field names, with previous, next and today controls, and a "+N more" past three events a day.',
  notes: [PLACE_NOTE, DATA_NOTE, THEME_NOTE],
  params: [
    stringParam('headline', 'The heading above the calendar. Empty to omit.', '[Schedule]'),
    stringParam('table', 'The table the events are read from.', 'events'),
    stringParam('dateField', 'The date field that places each event.', 'starts_on'),
    stringParam('labelField', 'The text field drawn on each event.', 'title'),
  ],
  tables: [
    {
      param: 'table',
      fields: [
        { name: 'starts_on', param: 'dateField', type: 'date' },
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
              dateField: p('dateField'),
              labelField: p('labelField'),
              defaultView: 'month',
              maxEventsPerDay: 3,
            },
          ],
          'gap-4'
        ),
      ])
    )
  },
})
