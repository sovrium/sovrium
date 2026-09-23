# Charts

> The `chart` component — six chart types over an aggregate of records, with series, axes, a legend and a tooltip.

A chart summarises records and plots the result. The chart kind is the `chartType` **property**, not the component `type`: a chart component is always `type: chart`.

<!-- sovrium:options type:chart depth=3 -->

`chartType` is `bar`, `line`, `area`, `pie`, `donut` or `scatter`. `legend` takes `{ position, visible }`, where `position` is `top`, `bottom`, `left`, `right` or `none`, and `tooltip` takes `{ format }` — a template supporting `{label}` and `{value}`.

A `series` entry takes `field`, `label` for the legend and tooltip, `color` as a theme token or a raw value, `stack` — series sharing a stack group name stack together — and `fillOpacity` from 0 to 1 for area and bar fills. An axis takes `field`, `label`, `scale` (`linear` or `logarithmic`), `format` (`date`, `currency`, `number` or `percent`) and `gridLines`.

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
      - type: chart
        chartType: bar
        dataSource: { table: orders }
        chartAggregate: { function: sum, field: total, groupBy: created_at, interval: month }
        xAxis: { field: created_at, label: Month, format: date }
        yAxis: { field: total, label: Revenue, format: currency, gridLines: true }
        series: [{ field: total, label: Revenue, color: primary }]
        legend: { position: bottom, visible: true }
```

## `chartAggregate`

`groupBy` is **required** — it names the field the records are grouped by, which is the chart's categories. `function` is `count`, `sum`, `avg`, `min` or `max`, and `field` is what the function operates on; omit it for `count`. `interval` buckets a date grouping into `day`, `week`, `month`, `quarter` or `year`.

## Size is the container's business

A chart has no `height` property. It fills the width of whatever holds it — a page column, a grid cell, a card — and the engine derives the height from that width, keeping the plot wider than it is tall at every size. So the lever on a chart's shape is the width of its container: put two charts in a two-column `grid` and each is shorter than one spanning the page.

The exception is a legend placed to the side, `legend.position: left` or `right`, which takes its width from the plot. In a narrow column that leaves little room for the drawing itself, so prefer `top` or `bottom` there.
