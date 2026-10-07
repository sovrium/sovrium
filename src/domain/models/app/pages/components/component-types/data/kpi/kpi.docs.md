# KPI Cards

> The `kpi` component — a single summary metric, with an optional comparison, sparkline and thresholds.

A KPI card states one number. It aggregates the records its `dataSource` binds and formats the result. It binds the same way every data component does: to one of the table's views with `dataSource: { table, view }`, the view then owning the filter, sort, grouping and visible fields, or directly to the table with `dataSource: { table }` and its own optional `filter` and `sort`. Bound to a view, the number counts or totals the records the view returns.

The figure is computed by the server over every record the binding matches, through the table's aggregate read (`GET /api/tables/:tableId/aggregate`) — one request per card, never a page of records added up in the browser, so a count over 250 records says 250. Cards that ask the same question of the same table and filter share one request. A card with a `sparkline` also reads the records the sparkline is drawn from. A count, or a figure over a number field, comes from the aggregate read; a `min` or `max` over a date is still worked out from a page of records.

<!-- sovrium:options type:kpi depth=3 -->

`label` is the metric's name and `icon` draws beside the value. `kpiAggregate` is `{ function, field }` — `function` is required, and `field` is omitted for `count` and `ratio`. `kpiFormat` is `{ type, options }`, where `type` is `number`, `currency`, `percentage`, `compact` or `bytes`. A `number` format writes the figure in the page's language — a page whose `meta.lang` is `fr-FR` groups thousands with a space and uses a decimal comma — and reads `minimumFractionDigits` and `maximumFractionDigits` from `options`, so `options: { maximumFractionDigits: '1' }` shows an average of 493.875 as `493.9`, or `493,9` on a French page. A `currency` format shows the precision of the field it summarises — a whole-euro field reads `€667,000`, a field with two decimals keeps its cents — and `currency` and `compact` write the figure in the page language, as `number` does (`667 000 €`, `1,2 M` on a French page). `options.currency` names the currency when declared; a field that declares its own `thousandsSeparator` keeps it on any page. `thresholds` are `{ value, color }` entries that recolour the card once a value is crossed, over `red`, `green`, `yellow`, `blue` and `gray`.

```yaml
tables:
  - name: orders
    fields:
      - { name: total, type: currency, currency: EUR }
      - { name: created_at, type: created-at }
pages:
  - name: Revenue
    path: /revenue
    components:
      - type: kpi
        label: Revenue this month
        icon: banknote
        dataSource: { table: orders }
        kpiAggregate: { function: sum, field: total }
        kpiFormat: { type: currency, options: { currency: EUR } }
        trend: { comparisonPeriod: previousMonth, direction: up, changePercent: 12.4, color: green }
        sparkline: { field: total, groupBy: created_at, interval: day, days: 30 }
```

## A rate: `function: ratio`

A rate — replies over conversations, meetings over calls — is two counts, and `function: ratio` shows them as one figure. `numerator` and `denominator` are each `{ filter }`, a list of conditions in the `dataSource.filter` grammar, and both are required with `ratio` and refused with any other function. Each side counts the records of the card's own data source that also meet its `filter`, so a condition on `dataSource.filter` applies to both. The figure is `numerator ÷ denominator × 100`, which `kpiFormat: { type: percentage }` prints as is, and the two counts are written under it as `3 / 8`. Both counts come from one aggregate read.

```yaml
- type: kpi
  label: LinkedIn reply rate
  dataSource:
    table: conversations
    filter:
      - { field: channel, operator: eq, value: linkedin }
  kpiAggregate:
    function: ratio
    numerator:
      filter:
        - { field: status, operator: eq, value: replied }
    denominator:
      filter:
        - { field: status, operator: isNotEmpty }
  kpiFormat: { type: percentage }
```

When nothing matches the denominator the card shows no figure — the neutral dash — over `0 / 0`, rather than a `0%` that would read as "none of them". `ratio` is a KPI function only: a chart and a table footer keep `count`, `sum`, `avg`, `min` and `max`.

The aggregate read answers a ratio when it is sent `numerator` and `denominator` filter expressions beside `filter`; its response then carries `ratio: { numerator, denominator, percent }`, with `percent` `null` over an empty denominator. Sending one side without the other answers `400`.

## `trend`

All three of `comparisonPeriod`, `direction` and `changePercent` are required once `trend` is present. `comparisonPeriod` is `previousDay`, `previousWeek`, `previousMonth`, `previousQuarter` or `previousYear`; `direction` is `up`, `down` or `flat`; `changePercent` is the change as a number; and `color` is `green`, `red`, `yellow` or `gray`.

**`direction` and `color` are independent on purpose.** Revenue up is green; churn up is red. Sovrium will not guess which of your metrics improve by rising, so state the colour you mean.

## `sparkline`

All four properties are required once `sparkline` is present: `field` is plotted along the line, `groupBy` buckets the points, `interval` is `day`, `week` or `month`, and `days` is how far back the line covers.

## Size and tone

`size` sets how large the value is drawn, per breakpoint: `sm`, `md` (the default) or `lg`, keyed `mobile`, `sm`, `md`, `lg`, `xl`, `2xl`. A breakpoint left out inherits the nearest narrower one, so `size: { mobile: sm, md: md }` draws a row of figures smaller on a phone and at full size from `md` up. `tone` gives the value a fixed semantic colour — `success`, `warning`, `error` or `muted` — for a figure that always reads as a warning because of what it counts. A colour that depends on the value is `thresholds`' job, and a matching threshold wins over the tone.

## A field the reader may not read

A KPI whose `kpiAggregate.field` its reader may not read keeps its card and its `label`, and shows her no value: the page does not name the field, and the card never falls back to another figure under the same label. It answers exactly as a KPI over a table she may not read.
