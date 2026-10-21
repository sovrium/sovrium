# Date, Range & Record Controls

> The four remaining form controls — slider, date-picker, date-range-picker and record-picker.

Four controls handle values a plain text box handles badly: a numeric span, a single date, a period, and a link to another table's row. The number, time and file inputs a reader might expect here are specialty types and are documented with those.

```yaml
components:
  - { type: slider, min: 0, max: 100, step: 5, showValue: true, props: { name: score } }
  - { type: date-picker, datePickerMode: range, props: { name: stay } }
```

## `slider`

A range input for a numeric value or a span. Reference: shadcn/ui Slider.

<!-- sovrium:options type:slider -->

`defaultValue` takes a single number, or a pair for a range.

## `date-picker`

A calendar-based date input. Reference: shadcn/ui Date Picker.

<!-- sovrium:options type:date-picker -->

The mode property is `datePickerMode`, not `mode` — `mode` belongs to `dataSource` and would be ignored here. `single` selects one date, `range` a start and an end.

## `date-range-picker`

A period rather than a date: two calendars side by side, and named presets resolved against the clock.

<!-- sovrium:options type:date-range-picker -->

The ten presets are `today`, `yesterday`, `last-7-days`, `last-30-days`, `this-month`, `last-month`, `this-quarter`, `last-quarter`, `this-year` and `last-year`. The list is closed because each is a computation over the current date rather than a value you could write down — which is also the point of using one. "Last quarter" resolves when the panel opens, so a dashboard bookmarked in March and opened in July shows July's answer rather than March's. Choosing a preset is a whole period, so it closes the panel and puts the reader back on the field. Omit `presets` to draw no preset column at all; `months` shows one or two calendars, defaulting to two.

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

## `rating`

A row of stars that reads, and inside a form writes, a `rating` field. No shadcn counterpart; its parts follow shadcn/ui's naming. An earned star is drawn in the primary colour, an unearned one in a muted tone, so the shape of the scale stays visible.

<!-- sovrium:options type:rating -->

Inside a form it is an input: a radio group named "3 of 5", moved with the arrow keys, that submits a whole number. Elsewhere it reads the field from the bound record and draws it read-only. The number of stars comes from `max`, else from the field's own `max`, else five. `allowHalf` rounds a read-only value to the nearest half star, which is only ever true of an average; an input always takes whole stars.

## `signature-pad`

The control that writes a `signature` field, and the reading that shows one.

<!-- sovrium:options type:signature-pad -->

The signer reads `statement` above a dashed well, draws in it, and confirms; with `allowTyped` (on by default) they may type their full name instead, which is a signature too and the path a reader who cannot draw needs. What is stored is the image, the signer's name, the instant, how it was made, and the statement as it read at that moment — so a later edit of the config cannot change what an existing signature agreed to. A signed field is written once: from then on the pad shows "Signed by … on …" and no well. Reference: shadcn/ui Button, Item. Clear, Type your name instead and Sign sit together at the end of the row, Sign being the one primary button; a signed field is drawn as one outlined item with a check.

## Narrowing data from a control

Any control that holds a value can narrow the data components on the page through `publishes`, on the channel a data component names in `dataSource.bindTo` beside `sharedFilter: {}` (**Data Binding** describes the channel). `{ bindTo, param }` publishes the value as one request param; `{ bindTo, field, operator }` publishes it as one condition, `field operator value`, combined with AND with every other condition on the channel.

```yaml
name: my-app
tables:
  - id: 1
    name: deals
    fields:
      - { id: 1, name: title, type: single-line-text }
      - { id: 2, name: stage, type: single-select, options: [lead, won, lost] }
      - { id: 3, name: amount, type: currency, currency: EUR }
      - { id: 4, name: closing, type: date }
pages:
  - name: Pipeline
    path: /pipeline
    components:
      - type: search-input
        placeholder: Search deals
        publishes: { bindTo: deals, param: q }
      - type: toggle-group
        toggleType: multiple
        options: [{ value: lead, label: Lead }, { value: won, label: Won }]
        publishes: { bindTo: deals, field: stage, operator: in }
      - type: slider
        min: 0
        max: 100000
        publishes: { bindTo: deals, field: amount, operator: lte }
      - type: date-range-picker
        publishes: { bindTo: deals, field: closing }
      - type: table
        dataSource: { table: deals, bindTo: deals, sharedFilter: {} }
        columns: [{ field: title, label: Title }, { field: stage, label: Stage }]
```

- `select`, `combobox` and `native-select` publish the chosen value; a multiple select, the values comma-joined.
- `toggle-group` publishes the pressed value, or under `toggleType: multiple` the pressed values comma-joined, which `in` reads as "any of".
- `slider` publishes its value when the thumb is released.
- `switch` and `toggle` contribute their condition while on, comparing `value` (default `true`), and withdraw it when turned off: "Only open tickets" is one switch.
- `date-range-picker` publishes the period as two conditions on one date field, `{ bindTo, field }`, both ends included, or as two request params, `{ bindTo, params: { from, to } }`.
- `search-input` publishes the query as `{ bindTo, param: q }`, which the records API answers with its full-text search; it then needs no `scope`.

Clearing a control withdraws what it published. `url: true` on any of them mirrors the contribution in the page address, as `?<channel>.<key>=`, so a reload or a shared link opens with the same narrowing; it is written in the browser and stored nowhere else. `sovrium validate` warns, without failing, about a channel a data component listens to and no control publishes on, and about one a control publishes on and nothing listens to. A publishing control names the components it narrows in `aria-controls`, and each of those announces its new result count to a screen reader.
