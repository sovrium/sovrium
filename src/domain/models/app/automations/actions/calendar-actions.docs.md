# Calendar Actions

> Pull the events of an external iCalendar feed into a table, matched on each event's UID and kept current on a schedule — or build an `.ics` invite for one event and attach it to an email.

`calendar` / `importIcs` reads an iCalendar (`.ics`) feed — a Proton booking page, a shared Google calendar, any calendar's "secret address" — and writes one row per event into a table. Run it from a `cron` trigger to keep the table in step with the calendar.

<!-- sovrium:options CalendarImportIcsActionSchema -->

```yaml
tables:
  - id: 1
    name: meetings
    fields:
      - { id: 1, name: ics_uid, type: single-line-text, unique: true }
      - { id: 2, name: title, type: single-line-text }
      - { id: 3, name: starts_at, type: datetime }
      - { id: 4, name: ends_at, type: datetime }
      - { id: 5, name: room, type: single-line-text }
    calendarFeed: { start: starts_at, end: ends_at, title: title }
automations:
  - name: pull-bookings
    trigger: { type: cron, expression: '*/15 * * * *' }
    actions:
      - name: importBookings
        type: calendar
        operator: importIcs
        props:
          url: $env.BOOKINGS_ICS_URL
          table: meetings
          matchField: ics_uid
          map: { location: room }
```

## How events become rows

- **Matched on UID.** A row whose `matchField` holds the event's `UID` is updated; otherwise a row is created. An event without a `UID`, or a second event carrying a `UID` already read, is skipped.
- **Unchanged rows are left alone.** A row that already holds the event's values is not written, so frequent schedules cost writes only for what changed.
- **Changed rows are ordinary record writes.** The table's record automations and webhooks run for them, and a chain of automations they start stops at the usual depth limit.
- **Nothing is deleted.** An event removed from the calendar keeps its row. A cancelled event is skipped, unless `map` names a field for `status`, in which case it is imported with its status.
- **Repeating events** are imported once, at their first occurrence; their other occurrences are not expanded, and a single occurrence that was moved or changed is skipped.

## Mapping

`map` names the field each event property is written to: `summary`, `description`, `location`, `start`, `end`, `url`, `status`. Leave it out and the table's own `calendarFeed` is used backwards — its `title` receives the summary, `description` the notes, `start` and `end` the times. A step with neither is refused when the configuration is loaded.

Times written with a zone are stored as that instant; times without one, or with a zone name the server does not know, are read in the operator timezone (`SOVRIUM_TIMEZONE`). An all-day event written to `date` fields keeps its days, its end being the last day it covers; written to `datetime` fields it starts at midnight UTC. A timed event written to a `date` field keeps the day it starts on in its own time zone. A mapped property the event does not carry clears its field.

## Output

`{ created, updated, unchanged, skipped, total }`, readable by the next steps.

## Limits

The feed is fetched with the same outbound protections and default timeout (15 seconds) as `http/get`, including the refusal of private and cloud-metadata addresses; its body may be up to 10 MiB. A `webcal://` address is read as `https://`. A feed answering an error status, a body that is not a calendar, a body over the size limit, or more than 5 000 events fails the step without writing a row.

## Sending an invite for one event

`calendar` / `exportIcs` builds an `.ics` file holding one event and returns it as `file`, which `email/send` attaches through its `attachments`. Every property is a template, so the step reads the record that started the run.

<!-- sovrium:options CalendarExportIcsActionSchema -->

```yaml
automations:
  - name: send-invite
    trigger:
      type: record
      table: registrations
      events: [create]
    actions:
      - name: invite
        type: calendar
        operator: exportIcs
        props:
          title: '{{trigger.record.event_title}}'
          start: '{{trigger.record.starts_at}}'
          end: '{{trigger.record.ends_at}}'
          location: '{{trigger.record.venue}}'
          timezone: Europe/Paris
      - name: mail
        type: email
        operator: send
        props:
          to: '{{trigger.record.email}}'
          subject: 'You are registered: {{trigger.record.event_title}}'
          body: '<p>See you there. The invite is attached.</p>'
          attachments: ['{{steps.invite.file}}']
```

- **Its time zone travels with it.** A timed event is written with its `TZID` and the zone's definition, so a calendar shows 18:30 in Paris for a December event and for an April one alike. Without `timezone` the operator timezone is used (`SOVRIUM_TIMEZONE`, UTC when unset).
- **Defaults.** Without `end`, a timed event lasts one hour and an all-day event one day. With `allDay: true`, `end` is the last day the event covers.
- **One identity per event.** Without `uid`, the event is identified as `<table>-<record id>@<host>`, so a second invite for the same record updates the event in the member's calendar instead of adding another. A run no record started must set `uid`.
- **Values cannot add to the event.** Commas, semicolons and line breaks in a value are escaped as calendar text.
- **The file is temporary.** It is written under the temporary prefix, swept like any temporary automation file. The step returns `{ file, uid }`.
- **Failures stop the run.** An end before the start, an unknown time zone or a missing `uid` fails the step, and nothing is sent.
