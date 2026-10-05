# Calendars

> The `calendar` component — a month, week or day view of date-bearing records.

A calendar places each record on the date its `dateField` names. The field mappings sit at the top level; only click handling and the time-grid settings live under `calendarEvent` and `calendarInteraction`.

<!-- sovrium:options type:calendar depth=3 -->

`dateField` supplies each event's start and `endDateField` its end, for events that span time. The end of a `date` range is the last day included: a leave from the 3rd to the 17th is drawn on the 17th and not on the 18th, and dragging it keeps that meaning. A `datetime` end is the instant it names. `labelField` is rendered as the event's label, and `defaultView` is `month`, `week` or `day`. `maxEventsPerDay` caps a day cell before it collapses into a "+N more" affordance.

`calendarEvent.onEventClick` runs when an event is clicked and `calendarInteraction.onDateClick` when an empty date or slot is. `onEventClick` takes `{ action: openDrawer, component: <id> }` like a grid row, opening the named drawer on the clicked record, or a `navigate` path. A `navigate` path is filled from the clicked event's record and only ever opens a page on this site; one that points to another site or at a script does not navigate. `calendarInteraction.timeSlotInterval` is the slot length in minutes for week and day views, and `showCurrentTimeIndicator` draws a line at the current time.

```yaml
tables:
  - name: bookings
    fields:
      - { name: customer_name, type: single-line-text }
      - { name: starts_at, type: datetime }
      - { name: ends_at, type: datetime }
pages:
  - name: Bookings
    path: /bookings
    components:
      - type: calendar
        dataSource: { table: bookings }
        dateField: starts_at
        endDateField: ends_at
        labelField: customer_name
        defaultView: week
        calendarInteraction: { timeSlotInterval: 30, showCurrentTimeIndicator: true }
```

## A coloured event is a block, not a dot

A calendar reads `colorField` at the top level — the record-view colour rules are the same ones a kanban board follows, including where the hue comes from and what happens when a value declares none. An event takes one colour, from one option, so `colorField` must name a `single-select`: a `multi-select` is refused when the config is read, naming the field.

In month view a calendar renders a timed event as a small dot by default. A dot is mostly empty space, so a colour applied to it is close to invisible. An event that carries a colour therefore renders as a filled **block** instead; an event with no colour keeps the default dot.

Expect that as a visible layout change on any month-view calendar that sets `colorField` — day cells that used to hold lines of dots now hold bands of filled blocks.

With no `colorField`, an event wears the theme's `primary`, in its dark value under the dark scheme, its text in `primary-foreground`. A `date` field draws an all-day event, with no time.

A calendar places a date-time event at the operator time zone's wall clock (`SOVRIUM_TIMEZONE`), or at the zone its field declares, on the same day and hour the grid shows, wherever the reader's browser is; a `date` field stays an all-day event.

## Controls follow the page's language

A calendar writes four words itself: the button that returns to the current period and the month, week and day switches. They follow the page's language (`meta.lang`): an English page reads Today, Month, Week, Day; a French page reads Aujourd’hui, Mois, Semaine, Jour. A language the calendar has no captions for keeps the English ones. The period title is a date and follows the page's language too, so a French month view is titled with the French month name.

## On a phone

Below the small breakpoint, a calendar in month view reads as an agenda: the month's events stacked in date order under their day, each title in full, with no sideways scroll — seven day columns at phone width leave a title too little room to be read. The toolbar still pages from month to month, and a click on an event does what it does on the grid. Week and day views are unchanged. The view switch offers the agenda as a view of its own, in the month's place: `Agenda` reads pressed while the agenda is drawn, the month grid is not offered at phone width, and Week or Day take over from it. A wider screen offers Month and no Agenda.

## A field the reader may not read

A reader who may read the table but not a field the calendar names sees the calendar without it, and the page carries neither the field's name nor its options: a hidden `colorField` draws every event uncoloured, and a hidden `endDateField` or `labelField` is left out. The date fields the calendar is told to read as whole days name only fields she may read. A calendar whose `dateField` she may not read has nothing to place and is left out of her page, as over a table she may not read. An event click whose `calendarEvent.onEventClick` path is built from a field she may not read does nothing for her, and the page does not carry the path; the event itself is still drawn.
