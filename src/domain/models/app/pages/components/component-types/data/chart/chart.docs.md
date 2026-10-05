# Charts

> The `chart` component — six chart types over an aggregate of records, with series, axes, a legend and a tooltip.

A chart summarises records and plots the result. The chart kind is the `chartType` **property**, not the component `type`: a chart component is always `type: chart`.

<!-- sovrium:options type:chart depth=3 -->

`chartType` is `bar`, `line`, `area`, `pie`, `donut` or `scatter`. `legend` takes `{ position, visible }`, where `position` is `top`, `bottom`, `left`, `right` or `none`, and `tooltip` takes `{ format }` — a template supporting `{label}` and `{value}`.

A `series` entry takes `field`, `label` for the legend and tooltip, `color` as a theme token or a raw value, `stack` — series sharing a stack group name stack together — and `fillOpacity` from 0 to 1 for area and bar fills. An axis takes `field`, `label`, `scale` (`linear` or `logarithmic`), `format` (`date`, `currency`, `number` or `percent`) and `gridLines`.

A `currency` value axis writes its ticks in the page language's compact notation with the field's currency (`€3.5K`, `3,5 k€`), never with cents.

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

A `month` grouping labels its axis with the short month in the page language (`Jul`, `juil.`), adding the year when the axis spans more than one year (`Dec 2025`, `Jan 2026`).

Under `chartAggregate`, one `series` names and colours the aggregate: its `label` is shown in the legend and the tooltip, and its `color` paints the bars, lines or areas; its `field` is not read, since the aggregate names the field. A second `series` entry has nothing to draw and is refused at boot, naming `series` and `chartAggregate`. A pie or donut keeps the colours of the grouping field's options.

A chart grouped, or a timeline laned, by a `user` or a labelled relationship names its categories by the label.

`order` sets the order of the categories: `option` follows the grouping field's declared options, `label` sorts the category names as they are displayed (an option's label, else its value), and `value-asc` or `value-desc` sort by the aggregated value. When it is omitted, a chart grouped by a `single-select` or `status` field follows the field's options; any other grouping is sorted by name, except on a pie or donut, whose slices run largest first. A chart grouped by a select field also paints each bar and pie or donut slice in the colour its option declares, and a pie or donut with a `legend` lists one entry per slice. A `yAxis` with `format: currency` prints the plotted field's currency and precision, grouped by thousands in the page language; a chart with `series` does so when every series plots a field of the same currency, and keeps a `$` otherwise.

## Size is the container's business

A chart has no `height` property. It fills the width of whatever holds it — a page column, a grid cell, a card — and the engine derives the height from that width, keeping the plot wider than it is tall at every size. So the lever on a chart's shape is the width of its container: put two charts in a two-column `grid` and each is shorter than one spanning the page.

The exception is a legend placed to the side, `legend.position: left` or `right`, which takes its width from the plot. In a narrow column that leaves little room for the drawing itself, so prefer `top` or `bottom` there.

## A field the reader may not read

A chart cannot be drawn without its categories or its plotted value. When its reader may read the table but not the field it groups by (`chartAggregate.groupBy`, else `xAxis.field`) or the field it plots (`chartAggregate.field`, else `yAxis.field`), the chart is left out of her page, exactly as over a table she may not read, and the page carries neither the field's name nor its option labels and colours. A `series` entry on a field she may not read is left out; a chart left with no series is left out of the page. A reader who may read every field the chart names sees it as written.
