/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry } from '@/library/manifest/define'

/** One new event, written as one row of the table. */
const fileEvent = (table: string): Readonly<Record<string, unknown>> => ({
  name: 'fileEvent',
  type: 'record',
  operator: 'create',
  props: {
    table,
    data: {
      google_id: '{{loop.item.id}}',
      title: '{{loop.item.summary}}',
      starts_at: '{{loop.item.start.dateTime}}',
      ends_at: '{{loop.item.end.dateTime}}',
      link: '{{loop.item.htmlLink}}',
    },
  },
})

/**
 * On a schedule, the Google Calendar events not seen before become rows of one
 * of the operator's tables — the same shape as the Pennylane and Qonto recipes:
 * paginated read, `filterNew` on the event id, one row per new event.
 */
export const entry = defineLibraryEntry({
  kind: 'recipe',
  slug: 'google-calendar-events-to-table',
  title: 'File new Google Calendar events into a table',
  category: 'productivity',
  tags: ['google', 'calendar', 'events', 'agenda', 'cron', 'sync'],
  description:
    'A scheduled automation that reads the events of a Google calendar and adds each one not seen before as a row of your table.',
  notes: [
    'The automation runs on the schedule `schedule` (every hour by default), reads every page of events of the calendar `calendarId` through the `list-events` operation of the `google` connection, keeps the ones it has not filed before, and creates one row per event in the table named by `table`.',
    'Recurring events are expanded into their occurrences, so each meeting of a weekly series is its own row. Its first run files nothing, so switching it on does not replay the whole calendar. Point it at your own table with `--set table=<your table>`; the table needs the fields listed below.',
  ],
  params: [
    {
      name: 'table',
      description: 'The table each new event is added to.',
      type: 'string',
      default: 'calendar_events',
    },
    {
      name: 'calendarId',
      description:
        'The calendar to read: `primary` for the connected account’s own, or a calendar id.',
      type: 'string',
      default: 'primary',
    },
    {
      name: 'schedule',
      description: 'When to run, as a cron expression.',
      type: 'string',
      default: '0 * * * *',
    },
  ],
  tables: [
    {
      param: 'table',
      fields: [
        { name: 'google_id', type: 'single-line-text' },
        { name: 'title', type: 'single-line-text' },
        { name: 'starts_at', type: 'single-line-text' },
        { name: 'ends_at', type: 'single-line-text' },
        { name: 'link', type: 'url' },
      ],
    },
  ],
  env: [],
  requires: ['connection/google'],
  provider: {
    name: 'Google Calendar',
    docsUrl: 'https://developers.google.com/workspace/calendar/api/v3/reference/events/list',
    verifiedOn: '2026-10-07',
  },
  build: ({ name, params }) => ({
    name,
    trigger: { type: 'cron', expression: String(params['schedule'] ?? '0 * * * *') },
    actions: [
      {
        name: 'fetch',
        type: 'connection',
        operator: 'call',
        props: {
          connection: 'google',
          operation: 'list-events',
          params: {
            calendarId: String(params['calendarId'] ?? 'primary'),
            singleEvents: true,
            orderBy: 'startTime',
          },
          paginate: 'all',
        },
      },
      {
        name: 'fresh',
        type: 'state',
        operator: 'filterNew',
        props: { input: '{{steps.fetch.data}}', key: 'id', namespace: 'google-calendar' },
      },
      {
        name: 'fileEach',
        type: 'loop',
        operator: 'each',
        props: {
          items: '{{steps.fresh.items}}',
          actions: [fileEvent(String(params['table'] ?? 'calendar_events'))],
        },
      },
    ],
  }),
})
