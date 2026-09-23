/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `date-picker` — one date, entered by calendar or by keyboard.
//
// Both drawings are the real component. The closed form is what a reader meets in
// a form row; the open form is its own calendar, which nothing here positions.
//
// `dateFormat` is drawn rather than listed because the choice it encodes is about
// the READER, not the data: the stored value is an ISO date either way, and the
// format decides whether a French reader reads 03/09 as March or September.

import type { PageComponent, TypePageBody } from './body-shape'

const datePicker: TypePageBody = {
  drawings: [
    {
      label: 'closed',
      children: [
        {
          type: 'field',
          fieldLabel: 'Close date',
          children: [
            { type: 'date-picker', dateFormat: 'DD/MM/YYYY', props: { name: 'close-date' } },
          ],
        },
      ],
    },
    {
      label: 'bounded calendar',
      children: [
        {
          type: 'field',
          fieldLabel: 'Close date',
          children: [
            {
              type: 'date-picker',
              dateFormat: 'DD/MM/YYYY',
              minDate: '2026-01-01',
              maxDate: '2026-12-31',
              props: { name: 'close-date-open', specimenOpen: true },
            },
          ],
        },
      ],
    },
  ],
  options: [
    {
      id: 'mode',
      title: 'Mode',
      configKey: 'date-picker.datePickerMode',
      drawings: [
        {
          label: "datePickerMode: 'single'",
          children: [
            {
              type: 'field',
              fieldLabel: 'Close date',
              children: [
                { type: 'date-picker', dateFormat: 'DD/MM/YYYY', props: { name: 'dp-single' } },
              ],
            } as PageComponent,
          ],
        },
        {
          label: "datePickerMode: 'range'",
          children: [
            {
              type: 'field',
              fieldLabel: 'Period',
              children: [
                {
                  type: 'date-picker',
                  datePickerMode: 'range',
                  dateFormat: 'DD/MM/YYYY',
                  props: { name: 'dp-range' },
                },
              ],
            } as PageComponent,
          ],
        },
      ],
    },
    {
      id: 'bounds',
      title: 'Bounds',
      configKey: 'date-picker.minDate | maxDate',
      drawings: [
        {
          label: 'minDate · maxDate',
          children: [
            {
              type: 'field',
              fieldLabel: 'Close date',
              children: [
                {
                  type: 'date-picker',
                  dateFormat: 'DD/MM/YYYY',
                  minDate: '2026-09-07',
                  maxDate: '2026-09-25',
                  props: { name: 'dp-bounds' },
                },
              ],
            } as PageComponent,
          ],
        },
      ],
    },
    {
      id: 'format',
      title: 'Format',
      configKey: 'date-picker.dateFormat',
      drawings: [
        {
          label: "dateFormat: 'DD/MM/YYYY'",
          children: [
            {
              type: 'field',
              fieldLabel: 'Close date',
              children: [
                { type: 'date-picker', dateFormat: 'DD/MM/YYYY', props: { name: 'dp-eu' } },
              ],
            } as PageComponent,
          ],
        },
        {
          label: "dateFormat: 'YYYY-MM-DD'",
          children: [
            {
              type: 'field',
              fieldLabel: 'Close date',
              children: [
                { type: 'date-picker', dateFormat: 'YYYY-MM-DD', props: { name: 'dp-iso' } },
              ],
            } as PageComponent,
          ],
        },
      ],
    },
  ],
}

export default datePicker
