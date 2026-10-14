/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `calendar` — a month of days a reader picks from.
//
// The calendar that places RECORDS on dates is `event-calendar`
// (`event-calendar.ts`); this one holds no data and picks a date, a range or a
// set of dates. `mode` decides which, and `defaultValue` takes the matching
// shape — one ISO date, `{ from, to }`, or a list. Every drawing names its
// `defaultValue` so the month shown is the same however the page is opened.

import type { PageComponent, TypePageBody } from './body-shape'

const day = (extra: Readonly<Record<string, unknown>>): PageComponent =>
  ({ type: 'calendar', defaultValue: '2026-10-14', ...extra }) as PageComponent

const calendar: TypePageBody = {
  drawings: [{ label: 'single', children: [day({})] }],
  options: [
    {
      id: 'mode',
      title: 'Mode',
      configKey: 'calendar.mode',
      drawings: [
        {
          label: "mode: 'range'",
          children: [
            day({ mode: 'range', defaultValue: { from: '2026-10-19', to: '2026-10-23' } }),
          ],
        },
        {
          label: "mode: 'multiple'",
          children: [
            day({ mode: 'multiple', defaultValue: ['2026-10-06', '2026-10-14', '2026-10-27'] }),
          ],
        },
      ],
    },
    {
      id: 'months',
      title: 'Months',
      configKey: 'calendar.months',
      drawings: [
        {
          label: 'months: 2',
          children: [
            day({
              mode: 'range',
              months: 2,
              defaultValue: { from: '2026-10-26', to: '2026-11-06' },
            }),
          ],
        },
      ],
    },
    {
      id: 'caption-layout',
      title: 'Caption layout',
      configKey: 'calendar.captionLayout',
      drawings: [
        { label: "captionLayout: 'label'", children: [day({ captionLayout: 'label' })] },
        { label: "captionLayout: 'dropdown'", children: [day({ captionLayout: 'dropdown' })] },
      ],
    },
    {
      id: 'disabled',
      title: 'Disabled days',
      configKey: 'calendar.disabled',
      drawings: [
        {
          label: 'disabled: { daysOfWeek: [0, 6] }',
          children: [day({ disabled: { daysOfWeek: [0, 6] } })],
        },
      ],
    },
  ],
}

export default calendar
