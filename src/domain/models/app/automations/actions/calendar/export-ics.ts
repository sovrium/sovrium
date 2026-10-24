/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

/** One templated event property, required. */
const requiredEventText = (description: string) =>
  TemplateStringSchema.pipe(Schema.annotate({ description }), Schema.check(Schema.isMinLength(1)))

/** One templated event property, optional; left out, the event carries no such property. */
const optionalEventText = (description: string) =>
  Schema.optional(TemplateStringSchema.pipe(Schema.annotate({ description })))

/**
 * Calendar Export ICS Action (type: calendar, operator: exportIcs)
 *
 * Build an iCalendar (`.ics`) file holding ONE event — the "add to calendar"
 * invite of an event a member registered for — and write it as a temporary
 * file, so a later step can attach it: `email/send` reads it through its
 * existing `attachments`, as `'{{steps.<name>.file}}'`. No key was added to
 * `email/send` for it.
 *
 * Every event property is a template, so the step reads a record without
 * naming a table: `title: '{{trigger.record.title}}'`. The whole-table feed
 * is a different thing (`tables[].calendarFeed`); this is one event, for one
 * person, at one moment.
 *
 * A timed event is written with its `TZID`, so a calendar shows it at the
 * right hour on both sides of a daylight-saving change; an all-day event is
 * written as dates, with the exclusive end day iCalendar expects.
 *
 * The `UID` is what lets a calendar recognise a second invite for the same
 * event as an update rather than a new event, so it must be stable for that
 * event: the default derives it from the record that started the run.
 */
export const CalendarExportIcsActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('calendar').pipe(
    Schema.annotate({
      description: "Constant value 'calendar' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('exportIcs').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'calendar' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    title: requiredEventText(
      "The event's title (`SUMMARY`), as a template (e.g. '{{trigger.record.name}}')."
    ),
    start: requiredEventText(
      "When the event starts (`DTSTART`), as a template resolving to an ISO 8601 date or date-time (e.g. '{{trigger.record.starts_at}}'). With `allDay`, only its day is used."
    ),
    end: optionalEventText(
      'When the event ends (`DTEND`), as a template resolving to an ISO 8601 date or date-time. Without it a timed event lasts one hour and an all-day event one day. An end before the start fails the step.'
    ),
    allDay: Schema.optional(
      Schema.Boolean.pipe(
        Schema.annotate({
          defaultNote: 'false',
          description:
            'Write the event as whole days rather than times. `end`, when given, is the LAST day the event covers; the file carries the day after, as iCalendar expects.',
        })
      )
    ),
    location: optionalEventText('Where the event takes place (`LOCATION`), as a template.'),
    description: optionalEventText(
      "The event's notes (`DESCRIPTION`), as a template. Line breaks are kept."
    ),
    timezone: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          defaultNote: 'the operator timezone (`SOVRIUM_TIMEZONE`, UTC when unset)',
          description:
            'IANA time zone a timed event is written in (`TZID`, e.g. "Europe/Paris"), so a calendar shows it at the right hour across daylight-saving changes. A zone the engine does not know fails the step.',
        })
      )
    ),
    uid: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          defaultNote:
            '`<table>-<record id>@<host>` from the record that started the run; a run started by no record must set it, or the step fails',
          description:
            "The event's stable identifier (`UID`). A calendar that already holds an event with this `UID` updates it instead of adding a second one, so keep it the same for every invite to the same event.",
        })
      )
    ),
  }).annotate({
    description:
      'The event to write: its title, start and optional end, whether it is all-day, where it is, its notes, the time zone it is written in, and its stable identifier.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'CalendarExportIcsAction',
    title: 'Calendar Export ICS Action',
    description:
      'Build an iCalendar (`.ics`) file holding one event and write it as a temporary file, returned as `file` so a later step can attach it to an email.',
    howTo:
      "Send a registration invite: an `exportIcs` step named `invite` fills `title`, `start` and `end` from the trigger's record, then `email/send` lists `'{{steps.invite.file}}'` in its `attachments`.",
  })
)

/** @public */
export type CalendarExportIcsAction = Schema.Schema.Type<typeof CalendarExportIcsActionSchema>
