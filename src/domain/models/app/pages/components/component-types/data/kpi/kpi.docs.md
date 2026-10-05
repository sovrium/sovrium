# KPI Cards

> The `kpi` component — a single summary metric, with an optional comparison, sparkline and thresholds.

A KPI card states one number. It aggregates the records its `dataSource` binds and formats the result.

<!-- sovrium:options type:kpi depth=3 -->

`label` is the metric's name and `icon` draws beside the value. `kpiAggregate` is `{ function, field }` — `function` is required, and `field` is omitted for `count`. `kpiFormat` is `{ type, options }`, where `type` is `number`, `currency`, `percentage`, `compact` or `bytes`. A `number` format writes the figure in the page's language — a page whose `meta.lang` is `fr-FR` groups thousands with a space and uses a decimal comma — and reads `minimumFractionDigits` and `maximumFractionDigits` from `options`, so `options: { maximumFractionDigits: '1' }` shows an average of 493.875 as `493.9`, or `493,9` on a French page. A `currency` format shows the precision of the field it summarises — a whole-euro field reads `€667,000`, a field with two decimals keeps its cents — and `currency` and `compact` write the figure in the page language, as `number` does (`667 000 €`, `1,2 M` on a French page). `options.currency` names the currency when declared; a field that declares its own `thousandsSeparator` keeps it on any page. `thresholds` are `{ value, color }` entries that recolour the card once a value is crossed, over `red`, `green`, `yellow`, `blue` and `gray`.

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

## `trend`

All three of `comparisonPeriod`, `direction` and `changePercent` are required once `trend` is present. `comparisonPeriod` is `previousDay`, `previousWeek`, `previousMonth`, `previousQuarter` or `previousYear`; `direction` is `up`, `down` or `flat`; `changePercent` is the change as a number; and `color` is `green`, `red`, `yellow` or `gray`.

**`direction` and `color` are independent on purpose.** Revenue up is green; churn up is red. Sovrium will not guess which of your metrics improve by rising, so state the colour you mean.

## `sparkline`

All four properties are required once `sparkline` is present: `field` is plotted along the line, `groupBy` buckets the points, `interval` is `day`, `week` or `month`, and `days` is how far back the line covers.

## A field the reader may not read

A KPI whose `kpiAggregate.field` its reader may not read keeps its card and its `label`, and shows her no value: the page does not name the field, and the card never falls back to another figure under the same label. It answers exactly as a KPI over a table she may not read.
