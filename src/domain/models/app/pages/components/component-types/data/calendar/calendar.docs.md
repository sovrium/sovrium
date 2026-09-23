# Calendars

> The `calendar` component — a month, week or day view of date-bearing records.

A calendar places each record on the date its `dateField` names. The field mappings sit at the top level; only click handling and the time-grid settings live under `calendarEvent` and `calendarInteraction`.

<!-- sovrium:options type:calendar depth=3 -->

`dateField` supplies each event's start and `endDateField` its end, for events that span time. `labelField` is rendered as the event's label, and `defaultView` is `month`, `week` or `day`. `maxEventsPerDay` caps a day cell before it collapses into a "+N more" affordance.

`calendarEvent.onEventClick` runs when an event is clicked and `calendarInteraction.onDateClick` when an empty date or slot is. `calendarInteraction.timeSlotInterval` is the slot length in minutes for week and day views, and `showCurrentTimeIndicator` draws a line at the current time.

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

A calendar reads `colorField` at the top level — the record-view colour rules are the same ones a kanban board follows, including where the hue comes from and what happens when a value declares none.

In month view a calendar renders a timed event as a small dot by default. A dot is mostly empty space, so a colour applied to it is close to invisible. An event that carries a colour therefore renders as a filled **block** instead; an event with no colour keeps the default dot.

Expect that as a visible layout change on any month-view calendar that sets `colorField` — day cells that used to hold lines of dots now hold bands of filled blocks.
