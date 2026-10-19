/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

/** A field of the target table an event property is written to. */
const mappedField = (description: string) =>
  Schema.optional(
    Schema.String.pipe(Schema.annotate({ description }), Schema.check(Schema.isMinLength(1)))
  )

/**
 * Which field of the target table each event property is written to. A
 * property left out is not written.
 */
const ImportIcsMapSchema = Schema.Struct({
  summary: mappedField("The field the event's title (`SUMMARY`) is written to."),
  description: mappedField("The field the event's notes (`DESCRIPTION`) are written to."),
  location: mappedField("The field the event's place (`LOCATION`) is written to."),
  start: mappedField(
    "The field the event's start (`DTSTART`) is written to: a `date` or a `datetime` field. An all-day event written to a `datetime` field starts at midnight UTC; a timed event written to a `date` field keeps the day it starts on in its own time zone."
  ),
  end: mappedField(
    "The field the event's end (`DTEND`, or `DTSTART` plus `DURATION`) is written to. For an all-day event written to a `date` field this is the last day the event covers, not the day after."
  ),
  url: mappedField("The field the event's link (`URL`) is written to."),
  status: mappedField(
    "The field the event's status (`STATUS`: `TENTATIVE`, `CONFIRMED` or `CANCELLED`) is written to."
  ),
})

/**
 * Calendar Import ICS Action (type: calendar, operator: importIcs)
 *
 * Fetch an iCalendar (`.ics`) feed and upsert its events into a table, one row
 * per event, matched on the event's `UID`. The fetch goes through the same
 * outbound-request guard as `http/*`. A repeating event is imported once, as
 * its first occurrence; changed single occurrences are not imported. An event
 * that disappears from the feed leaves its row in place.
 */
export const CalendarImportIcsActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('calendar').pipe(
    Schema.annotate({
      description: "Constant value 'calendar' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('importIcs').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'calendar' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    url: TemplateStringSchema.pipe(
      Schema.annotate({
        description:
          'The address of the iCalendar feed to read, `http(s)://` or `webcal://` (read as `https://`). Supports template variables and `$env.NAME`, so a secret address stays out of the config file.',
      })
    ),
    table: Schema.String.pipe(
      Schema.annotate({ description: 'The table the events are written to.' }),
      Schema.check(Schema.isMinLength(1))
    ),
    matchField: Schema.String.pipe(
      Schema.annotate({
        description:
          "The field of `table` that holds each event's `UID`. A row whose field holds the event's `UID` is updated; otherwise a row is created with it. A text field marked `unique` is the usual choice.",
      }),
      Schema.check(Schema.isMinLength(1))
    ),
    map: Schema.optional(
      ImportIcsMapSchema.pipe(
        Schema.annotate({
          description:
            'Which field of `table` each event property is written to. A property left out is not written.',
          defaultNote:
            "the table's own `calendarFeed`, read backwards: `title` receives the summary, `description` the notes, `start` and `end` the times",
        })
      )
    ),
  }).annotate({
    description:
      'Where the feed is, which table receives its events, the field that matches an event to its row, and where each event property goes.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'CalendarImportIcsAction',
    title: 'Calendar Import ICS Action',
    description:
      "Read an iCalendar (`.ics`) feed and create or update one row per event, matched on the event's `UID`. A row whose values already equal the event's is left untouched, so a frequent schedule does not rewrite unchanged rows.",
  })
)

/** @public */
export type CalendarImportIcsAction = Schema.Schema.Type<typeof CalendarImportIcsActionSchema>
