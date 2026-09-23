# Date, Range & Record Controls

> The four remaining form controls — slider, date-picker, date-range-picker and record-picker.

Four controls handle values a plain text box handles badly: a numeric span, a single date, a period, and a link to another table's row. The number, time and file inputs a reader might expect here are specialty types and are documented with those.

```yaml
components:
  - { type: slider, min: 0, max: 100, step: 5, showValue: true, props: { name: score } }
  - { type: date-picker, datePickerMode: range, props: { name: stay } }
```

## `slider`

A range input for a numeric value or a span.

<!-- sovrium:options type:slider -->

`defaultValue` takes a single number, or a pair for a range.

## `date-picker`

A calendar-based date input.

<!-- sovrium:options type:date-picker -->

The mode property is `datePickerMode`, not `mode` — `mode` belongs to `dataSource` and would be ignored here. `single` selects one date, `range` a start and an end.

## `date-range-picker`

A period rather than a date: two calendars side by side, and named presets resolved against the clock.

<!-- sovrium:options type:date-range-picker -->

The ten presets are `today`, `yesterday`, `last-7-days`, `last-30-days`, `this-month`, `last-month`, `this-quarter`, `last-quarter`, `this-year` and `last-year`. The list is closed because each is a computation over the current date rather than a value you could write down — which is also the point of using one. "Last quarter" resolves when the panel opens, so a dashboard bookmarked in March and opened in July shows July's answer rather than March's. Omit `presets` to draw no preset column at all; `months` shows one or two calendars, defaulting to two.

```yaml
components:
  - type: date-range-picker
    label: Period
    name: period
    value: 2026-09-01/2026-09-30
    months: 2
    presets: [today, last-7-days, this-month, last-month]
```

### One field, one value

`name` submits a single value — `2026-09-01/2026-09-30` — not a pair of `from` and `to` fields. A half-chosen period therefore cannot be sent: there is no state in which one end has arrived and the other has not.

`value` takes that same notation, and a **preset name is refused there by pattern**. A preset is what the panel offers; accepting one as the initial value would make the field mean two different things depending on which string it held. Presets belong in `presets`.

Reach for `date-picker` with `datePickerMode: range` when you want a range in one calendar and no presets; reach for this when the period is the point — a reporting window, a stay, a billing month.

## `record-picker`

Search another table and link the row you find. The reader types a name, the server matches it, and the record is linked by whatever column names it — never by its id.

<!-- sovrium:options type:record-picker depth=3 -->

`dataSource.displayField` is the column that NAMES a row: it is what is searched and what is shown. Omit it and the picker searches by id and says so, rather than guessing a column. `dataSource.filter` narrows which rows can be found at all, applied on the server on every page and every keystroke. `dataSource.pageSize` defaults to 20 with a maximum of 100 — a picker is a shortlist, and it tells you when there are more rather than truncating in silence.

`allowCreate` offers to create the record the search did not find and link it in one gesture; it is absent, never disabled, for a reader who cannot insert. `multiple` links more than one record as chips, and without it picking a second record replaces the first. `maxLinked` caps the count and closes the search at the cap. `readOnly` draws the linked value with no search box.

```yaml
tables:
  - name: companies
    fields:
      - { name: name, type: single-line-text }
      - { name: city, type: single-line-text }
pages:
  - name: Company picker
    path: /companies/pick
    components:
      - type: record-picker
        dataSource:
          table: companies
          displayField: name
          filter: [{ field: city, operator: eq, value: Lyon }]
        allowCreate: true
```

**You do not need this to link records inside a form or a grid.** A `relationship` column already draws this control wherever it is bound. Reach for `record-picker` when the page has no such column to dispatch from — a filter bar, a panel, a step that writes somewhere else.
