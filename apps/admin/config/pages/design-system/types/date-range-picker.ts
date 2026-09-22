/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `date-range-picker` — a span, which is a different thing from two dates.
//
// Four drawings over the two decisions this type carries. `months` says how much
// calendar a reader sees at once — one is enough inside a month, two is what a
// reader crossing a boundary needs, and most real spans cross one. `presets` is
// the one that changes how the control is used: most range choices are the same
// handful of spans, and a reader picking "Last 30 days" never opens the calendar.
//
// Two authoring facts. A preset is one of the schema's named periods, not a
// label-and-value pair — the dates have to be computed when the panel opens, so
// they cannot be written down. And `value` is an ISO interval `<from>/<to>`: the
// schema refuses a preset name there by pattern, so the field means one thing.

import type { TypePageBody } from './_shape'

const dateRangePicker: TypePageBody = {
  drawings: [
    {
      label: 'closed',
      children: [
        {
          type: 'date-range-picker',
          label: 'Period',
          name: 'period',
          dateFormat: 'DD/MM/YYYY',
          placeholder: 'Choose a period',
        },
      ],
    },
    {
      label: 'range bounds',
      children: [
        {
          type: 'date-range-picker',
          label: 'Period',
          name: 'period-open',
          months: 1,
          value: '2026-09-01/2026-09-18',
          props: { specimenOpen: true },
        },
      ],
    },
    {
      label: 'two-month layout',
      children: [
        {
          type: 'date-range-picker',
          label: 'Period',
          name: 'period-two',
          months: 2,
          value: '2026-08-24/2026-09-12',
          props: { specimenOpen: true },
        },
      ],
    },
    {
      label: 'preset ranges',
      children: [
        {
          type: 'date-range-picker',
          label: 'Period',
          name: 'period-presets',
          months: 2,
          presets: ['today', 'last-7-days', 'last-30-days', 'this-quarter'],
          props: { specimenOpen: true },
        },
      ],
    },
  ],
}

export default dateRangePicker
