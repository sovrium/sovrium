# KPI Cards

> The `kpi` component: a single summary metric, with an optional comparison, sparkline and thresholds.

A KPI card states one number. Reference: shadcn/ui Card, as the section cards of its dashboard block draw it: the label and its `icon` are the card description, in the muted foreground; the figure is the card title, in semibold tabular digits; the `trend` is an outline badge beside them; the `sparkline` sits in the card content and a ratio's two counts in the card footer. The card paints the `card` colour with a faint ring instead of a border, and while its figure loads it draws skeletons where the label and the figure will sit. A card among a page's own `components`, bound directly to a table and showing no ratio, arrives instead with the figure the server worked out for its reader, so the browser's find and a print reach it before its code runs. It aggregates the records its `dataSource` binds and formats the result. It binds the same way every data component does: to one of the table's views with `dataSource: { table, view }`, the view then owning the filter, sort, grouping and visible fields, or directly to the table with `dataSource: { table }` and its own optional `filter` and `sort`. Bound to a view, the number counts or totals the records the view returns.

The figure is computed by the server over every record the binding matches, through the table's aggregate read (`GET /api/tables/:tableId/aggregate`): one request per card, never a page of records added up in the browser, so a count over 250 records says 250. Cards that ask the same question of the same table and filter share one request. A card with a `sparkline` also reads the records the sparkline is drawn from. A count, or a figure over a number field, comes from the aggregate read; a `min` or `max` over a date is still worked out from a page of records.

<!-- sovrium:options type:kpi depth=3 -->

`label` is the metric's name and `icon` draws beside the value. `description` is the tile's legend, drawn under the value. `kpiAggregate` is `{ function, field }`: `function` is required, and `field` is omitted for `count` and `ratio`. `function` is `count`, `sum`, `avg`, `min`, `max`, `ratio`, or a percentile of a number field: `p50` (the median), `p75`, `p90`, `p95` or `p99`, interpolated between the two values around its rank and read from the aggregate read like a sum. Over records with no value a percentile has no figure, and the card shows the neutral dash rather than a `0` that would read as instant. `kpiFormat` is `{ type, options }`, where `type` is `number`, `currency`, `percentage`, `compact`, `bytes` or `duration`. A `duration` format writes an elapsed time as one compact figure in the page language (`180 ms`, `8.9 s`, `2 min 49 s`, `1 h 05 min`), the same figure a `duration` column prints; it reads the value as milliseconds, or as seconds with `options: { unit: s }`. A `number` format writes the figure in the page's language (a page whose `meta.lang` is `fr-FR` groups thousands with a space and uses a decimal comma), and reads `minimumFractionDigits` and `maximumFractionDigits` from `options`, so `options: { maximumFractionDigits: '1' }` shows an average of 493.875 as `493.9`, or `493,9` on a French page. `percentage` writes the figure in the page language too (`66.7%` on an English page, `66,7 %` on a French one), and reads `minimumFractionDigits` / `maximumFractionDigits` like `number`. A `currency` format shows the precision of the field it summarises (a whole-euro field reads `€667,000`, a field with two decimals keeps its cents), and `currency` and `compact` write the figure in the page language, as `number` does (`667 000 €`, `1,2 M` on a French page). `options.currency` names the currency when declared; a field that declares its own `thousandsSeparator` keeps that grouping on any page, while the page language still places the symbol unless the field declares `symbolPosition` (`667 000 €` on a French page for a field grouped by a space). `thresholds` are `{ value, color }` entries that recolour the card once a value is crossed, over `red`, `green`, `yellow`, `blue` and `gray`.

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

A rate (replies over conversations, meetings over calls) is two counts, and `function: ratio` shows them as one figure. `numerator` and `denominator` are each `{ filter }`, a list of conditions in the `dataSource.filter` grammar, and both are required with `ratio` and refused with any other function. Each side counts the records of the card's own data source that also meet its `filter`, so a condition on `dataSource.filter` applies to both. The figure is `numerator ÷ denominator × 100`, which `kpiFormat: { type: percentage }` prints as is, and the two counts are written under it as `3 / 8`. Both counts come from one aggregate read.

`caption` words that footer instead: a sentence in which `{numerator}` and `{denominator}` are replaced by the two counts: `caption: "{numerator} replied out of {denominator} contacted"` reads "3 replied out of 8 contacted". A `$t:` key is read in the page language first. `caption: false` draws no footer, so the card is the height of its neighbours. Without `caption` the footer reads `3 / 8`; a caption is refused on any function but `ratio`.

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

When nothing matches the denominator the card shows no figure (the neutral dash) over `0 / 0`, rather than a `0%` that would read as "none of them". `ratio` is a KPI function only: a chart keeps `count`, `sum`, `avg`, `min`, `max` and the percentiles, and a table footer keeps the first five.

Bound to a view, a ratio counts both sides over every row the view admits, through the view's own read, with the same caption and empty state.

The aggregate read answers a ratio when it is sent `numerator` and `denominator` filter expressions beside `filter`; its response then carries `ratio: { numerator, denominator, percent }`, with `percent` `null` over an empty denominator. Sending one side without the other answers `400`.

## `trend`

All three of `comparisonPeriod`, `direction` and `changePercent` are required once `trend` is present. `comparisonPeriod` is `previousDay`, `previousWeek`, `previousMonth`, `previousQuarter` or `previousYear`; `direction` is `up`, `down` or `flat`; `changePercent` is the change as a number; and `color` is `green`, `red`, `yellow` or `gray`.

The badge shows `changePercent` after an arrow that follows `direction`, and `color` paints that arrow. **`direction` and `color` are independent on purpose.** Revenue up is green; churn up is red. Sovrium will not guess which of your metrics improve by rising, so state the colour you mean. The arrow carries the direction on its own, so a reader who cannot tell the colours apart still reads it.

## `sparkline`

All four properties are required once `sparkline` is present: `field` is plotted along the line, `groupBy` buckets the points, `interval` is `minute`, `hour`, `day`, `week` or `month` (a minute or an hour is a UTC one), and `days` is how far back the line covers: `interval: hour` with `days: 1` draws the last 24 hours, one point per hour holding a record. The line is drawn in the second chart colour (`chart-2`).

## Size and tone

`size` sets how large the value is drawn, per breakpoint: `sm`, `md` (the default) or `lg`, keyed `mobile`, `sm`, `md`, `lg`, `xl`, `2xl`. A breakpoint left out inherits the nearest narrower one, so `size: { mobile: sm, md: md }` draws a row of figures smaller on a phone and at full size from `md` up. `tone` gives the value a fixed semantic colour (`success`, `warning`, `error` or `muted`) for a figure that always reads as a warning because of what it counts. A colour that depends on the value is `thresholds`' job, and a matching threshold wins over the tone.

## A figure kept current from a system read

A card bound to a platform read endpoint, `dataSource: { system: { endpoint, valuePath } }`, reads its figure once when the page opens. `refreshMode: poll` makes it read the endpoint again every `pollIntervalMs` milliseconds (1,000 to 300,000, 30,000 when left out) while the tab is visible, so a figure that changes elsewhere shows without a reload. `none`, the default, reads once. `realtime` is refused when the app starts: an endpoint has no change feed to follow.

```yaml
- type: kpi
  label: Failures (24h)
  dataSource:
    system:
      endpoint: /api/admin/automations/overview
      valuePath: totals.failures_24h
      refreshMode: poll
      pollIntervalMs: 15000
```

Cards reading the same endpoint with the same `query` share one request, and polling keeps that: four cards polling one endpoint every 15 seconds send one request every 15 seconds between them, not four. Cards on one endpoint that declare different intervals each keep their own. A poll that fails leaves the last figure on screen, since it was true one interval ago; a card that has never read its figure still shows the neutral dash.

## A field the reader may not read

A KPI whose `kpiAggregate.field` its reader may not read keeps its card and its `label`, and shows her no value: the page does not name the field, and the card never falls back to another figure under the same label. It answers exactly as a KPI over a table she may not read.
