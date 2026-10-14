# Calendar

> The `calendar` component — a calendar: a month of days to pick one date, a range, or several, inline on the page.

A `calendar` is the day grid itself, drawn in the page rather than behind a button: a delivery date to choose, the nights of a stay, the days someone is available. It reads in the page's language — month names, weekday names and the day the week starts on — and, given a `name`, submits its selection as ISO text with the form around it. Reference: shadcn/ui Calendar.

```yaml
components:
  - type: calendar
    name: delivery_date
    defaultValue: '2026-10-14'
    minDate: '2026-10-13'
    maxDate: '2026-11-30'
    disabled:
      daysOfWeek: [0, 6]
  - type: calendar
    name: stay
    mode: range
    months: 2
    defaultValue:
      from: '2026-10-19'
      to: '2026-10-23'
```

<!-- sovrium:options type:calendar -->

`mode` decides what is picked: `single` (one date, the default), `range` (a start and an end, chosen in two presses) or `multiple` (several dates, each press toggling one). `defaultValue` takes the matching shape — one ISO date, `{ from, to }`, or a list — and decides the month shown first; a shape that does not match the mode is refused when the config is validated. `minDate`, `maxDate` and `disabled` (`before`, `after`, `daysOfWeek` where 0 is Sunday, and `dates`) keep days from being pressed. `months` draws up to three months side by side, `captionLayout: dropdown` lets the reader jump to a month and a year, and `weekStartsOn` overrides the first column the page language would choose. With a `name`, the selection reaches the form as `2026-10-16`, as `2026-10-19/2026-10-23` for a range, and as dates joined by commas for several.

`type: calendar` used to name the view that places records on a month, week or day grid, which is now `event-calendar`. That view's keys (`dataSource`, `dateField`, `defaultView` and the rest) are refused on a `calendar` with a message naming `event-calendar`: rename the `type` and keep every key.
