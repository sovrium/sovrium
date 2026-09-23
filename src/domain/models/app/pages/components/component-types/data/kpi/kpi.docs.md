# KPI Cards

> The `kpi` component — a single summary metric, with an optional comparison, sparkline and thresholds.

A KPI card states one number. It aggregates the records its `dataSource` binds and formats the result.

<!-- sovrium:options type:kpi depth=3 -->

`label` is the metric's name and `icon` draws beside the value. `kpiAggregate` is `{ function, field }` — `function` is required, and `field` is omitted for `count`. `kpiFormat` is `{ type, options }`, where `type` is `number`, `currency`, `percentage`, `compact` or `bytes`. `thresholds` are `{ value, color }` entries that recolour the card once a value is crossed, over `red`, `green`, `yellow`, `blue` and `gray`.

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
