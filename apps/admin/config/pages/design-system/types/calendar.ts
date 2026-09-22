/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `calendar` — records placed on dates rather than listed.
//
// `dateField` is what makes it a calendar, and `endDateField` is what makes an
// entry a span rather than a point. Declare only the first and every record is a
// single day, whatever its data says. `labelField` is what each entry is called;
// without it a reader sees a coloured block and has to open it to learn what it
// is.
//
// ─── `defaultView` DECIDES WHERE A READER LANDS, NOT WHAT THEY CAN REACH ───
//
// It names three: `month`, `week`, `day`. Month is what a reader planning needs
// — the shape of a period, at the cost of the hours. Week and day trade that the
// other way, and are the right landing view only for a surface about one week or
// one day at a time. The reader switches between them with the control in the
// calendar's own header whichever one is declared.
//
// Both drawings declare `calendarInteraction.timeSlotInterval`. The hour-grid
// views read it while building their rows and month never does, which is why
// leaving it out looks harmless right up until a reader switches view.

import { SPECIMEN_ROWS_ENDPOINT } from '../../../systemSources'
import type { PageComponent, TypePageBody } from './_shape'

const BOUND = {
  system: {
    endpoint: SPECIMEN_ROWS_ENDPOINT,
    rowsKey: 'items',
    idKey: 'id',
    totalKey: 'total',
    query: { rows: '3' },
  },
}

/** The same calendar every time, with one key changed. */
const cal = (id: string, extra: Record<string, unknown> = {}) =>
  ({
    type: 'calendar' as const,
    props: { id },
    dataSource: BOUND,
    dateField: 'startsAt',
    endDateField: 'endsAt',
    labelField: 'name',
    defaultView: 'month' as const,
    calendarInteraction: { timeSlotInterval: 60 },
    ...extra,
  }) as PageComponent

const calendar: TypePageBody = {
  drawings: [
    {
      label: 'month',
      children: [
        {
          type: 'calendar',
          props: { id: 'design-system-calendar-month' },
          dataSource: {
            system: {
              endpoint: SPECIMEN_ROWS_ENDPOINT,
              rowsKey: 'items',
              idKey: 'id',
              totalKey: 'total',
            },
          },
          dateField: 'startsAt',
          endDateField: 'endsAt',
          labelField: 'name',
          defaultView: 'month',
          calendarInteraction: { timeSlotInterval: 60 },
        },
      ],
    },
    {
      label: 'week',
      children: [
        {
          type: 'calendar',
          props: { id: 'design-system-calendar-week' },
          dataSource: {
            system: {
              endpoint: SPECIMEN_ROWS_ENDPOINT,
              rowsKey: 'items',
              idKey: 'id',
              totalKey: 'total',
            },
          },
          dateField: 'startsAt',
          endDateField: 'endsAt',
          labelField: 'name',
          defaultView: 'week',
          calendarInteraction: { timeSlotInterval: 60 },
        },
      ],
    },
  ],
  options: [
    {
      id: 'default-view',
      title: 'Default view',
      configKey: 'calendar.defaultView',
      drawings: [
        {
          label: "defaultView: 'month'",
          children: [cal('cal-view-month', { defaultView: 'month' })],
        },
        {
          label: "defaultView: 'week'",
          children: [cal('cal-view-week', { defaultView: 'week' })],
        },
        {
          label: "defaultView: 'day'",
          children: [cal('cal-view-day', { defaultView: 'day' })],
        },
      ],
    },
    {
      id: 'dates',
      title: 'Dates',
      configKey: 'calendar.dateField | endDateField',
      drawings: [
        {
          label: 'dateField only',
          children: [cal('cal-start', { endDateField: undefined })],
        },
        {
          label: 'dateField + endDateField',
          children: [cal('cal-span')],
        },
      ],
    },
    {
      id: 'label',
      title: 'Label',
      configKey: 'calendar.labelField',
      drawings: [
        { label: "labelField: 'name'", children: [cal('cal-label-name')] },
        {
          label: "labelField: 'role'",
          children: [cal('cal-label-role', { labelField: 'role' })],
        },
      ],
    },
    {
      id: 'colour',
      title: 'Colour',
      configKey: 'calendar.colorField',
      drawings: [
        {
          label: "colorField: 'priority'",
          children: [cal('cal-colour', { colorField: 'priority' })],
        },
      ],
    },
    {
      id: 'density',
      title: 'Density',
      configKey: 'calendar.maxEventsPerDay',
      drawings: [
        {
          label: 'maxEventsPerDay: 1',
          children: [cal('cal-density', { maxEventsPerDay: 1 })],
        },
      ],
    },
    {
      id: 'hour-grid',
      title: 'The hour grid',
      configKey: 'calendarInteraction.timeSlotInterval | showCurrentTimeIndicator',
      drawings: [
        {
          label: 'timeSlotInterval: 60 · showCurrentTimeIndicator: true',
          children: [
            cal('cal-hour-grid', {
              defaultView: 'week',
              calendarInteraction: { timeSlotInterval: 60, showCurrentTimeIndicator: true },
            }),
          ],
        },
      ],
    },
    {
      id: 'interaction',
      title: 'Clicks',
      configKey: 'calendarInteraction.onDateClick | calendarEvent.onEventClick',
      drawings: [
        {
          label: 'onDateClick: create',
          children: [
            {
              type: 'code',
              props: { language: 'yaml' },
              content:
                'calendarInteraction:\n  onDateClick:\n    type: crud\n    operation: create\n    table: events',
            } as PageComponent,
          ],
        },
        {
          label: 'onEventClick: open the record',
          children: [
            {
              type: 'code',
              props: { language: 'yaml' },
              content: 'calendarEvent:\n  onEventClick:\n    type: navigate\n    url: /events/{id}',
            } as PageComponent,
          ],
        },
      ],
    },
  ],
}

export default calendar
