/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `chart` — a shape over records, not a picture of them.
//
// Two drawings at the top, over the same rows, because the choice between them
// is about the QUESTION rather than the taste: bars compare quantities across
// categories, a line follows one quantity through an order where the order is
// the point. Everything else this type can do is drawn further down, one key at
// a time.
//
// ─── TWO WAYS TO GET NUMBERS, AND THEY ARE NOT INTERCHANGEABLE ─────────────
//
// `chartAggregate` computes them: it counts or sums the rows per group, which is
// what a chart over records without a numeric column needs. `series[]` plots
// them: each entry names a field that already holds a number. A chart declaring
// neither has nothing to draw, and one declaring both is answering two
// questions at once.
//
// Which one is present also decides which canvas renders: under an aggregate,
// `line` draws a line and everything else draws bars; with a declared series,
// `bar` draws bars and everything else draws an area. Only `pie` and `donut`
// have a canvas of their own, reached from either. So `area` and `scatter` are
// drawn below with a series rather than an aggregate, because that is the only
// way either reaches the shape it names.

import { SPECIMEN_ROWS_ENDPOINT } from '../../../system-sources'
import type { PageComponent, TypePageBody } from './body-shape'

const ROWS = {
  system: { endpoint: SPECIMEN_ROWS_ENDPOINT, rowsKey: 'items', query: { rows: '3' } },
}

/** Counted per group — for rows whose interesting column is not a number. */
const counted = (id: string, extra: Record<string, unknown> = {}) =>
  ({
    type: 'chart' as const,
    props: { id, className: 'w-full' },
    dataSource: ROWS,
    chartType: 'bar' as const,
    chartAggregate: { function: 'count' as const, groupBy: 'status' },
    emptyMessage: 'No specimen rows',
    ...extra,
  }) as PageComponent

/** Plotted from a numeric column — the other half of the type. */
const plotted = (id: string, extra: Record<string, unknown> = {}) =>
  ({
    type: 'chart' as const,
    props: { id, className: 'w-full' },
    dataSource: ROWS,
    chartType: 'bar' as const,
    xAxis: { field: 'name' },
    series: [{ field: 'amount', label: 'Amount' }],
    emptyMessage: 'No specimen rows',
    ...extra,
  }) as PageComponent

const chart: TypePageBody = {
  drawings: [
    {
      label: 'bar',
      children: [counted('design-system-chart-bar')],
    },
    {
      label: 'line',
      children: [counted('design-system-chart-line', { chartType: 'line' })],
    },
  ],
  options: [
    {
      id: 'type',
      title: 'Type',
      configKey: 'chart.chartType',
      drawings: [
        {
          label: "chartType: 'bar'",
          children: [counted('chart-opt-bar')],
        },
        {
          label: "chartType: 'line'",
          children: [counted('chart-opt-line', { chartType: 'line' })],
        },
        {
          label: "chartType: 'area'",
          children: [plotted('chart-opt-area', { chartType: 'area' })],
        },
        {
          label: "chartType: 'pie'",
          children: [counted('chart-opt-pie', { chartType: 'pie' })],
        },
        {
          label: "chartType: 'donut'",
          children: [counted('chart-opt-donut', { chartType: 'donut' })],
        },
        {
          label: "chartType: 'scatter'",
          children: [plotted('chart-opt-scatter', { chartType: 'scatter' })],
        },
      ],
    },
    {
      id: 'series',
      title: 'Series',
      configKey: 'chart.series[]',
      drawings: [
        {
          label: 'series: [{ field, label }]',
          children: [plotted('chart-series-one')],
        },
        {
          label: 'series: [{ …, color }]',
          children: [
            plotted('chart-series-color', {
              series: [{ field: 'amount', label: 'Amount', color: '#3b82f6' }],
            }),
          ],
        },
        {
          label: 'series: [{ …, fillOpacity }]',
          children: [
            plotted('chart-series-fill', {
              chartType: 'area',
              series: [{ field: 'amount', label: 'Amount', fillOpacity: 0.15 }],
            }),
          ],
        },
        {
          label: 'series: [{ …, stack }]',
          children: [
            // TWO FIELDS, not one field twice. This drawing stacked `amount`
            // on `amount` under two labels, which plotted the same column on
            // top of itself — a bar of exactly double the height, showing
            // nothing a reader could learn about stacking — and collided the
            // two series on the same React key, which is four duplicate-key
            // warnings in the console of the page that is meant to be the
            // showcase. A stack is two DIFFERENT measures sharing a bar.
            plotted('chart-series-stack', {
              chartType: 'bar',
              series: [
                { field: 'amount', label: 'Amount', stack: 'totals' },
                { field: 'share', label: 'Share', stack: 'totals' },
              ],
            }),
          ],
        },
      ],
    },
    {
      id: 'legend',
      title: 'Legend',
      configKey: 'chart.legend.position',
      drawings: [
        {
          label: "legend: { position: 'top' }",
          children: [plotted('chart-legend-top', { legend: { position: 'top' } })],
        },
        {
          label: "legend: { position: 'bottom' }",
          children: [plotted('chart-legend-bottom', { legend: { position: 'bottom' } })],
        },
        {
          label: "legend: { position: 'right' }",
          children: [plotted('chart-legend-right', { legend: { position: 'right' } })],
        },
        {
          label: "legend: { position: 'none' }",
          children: [plotted('chart-legend-none', { legend: { position: 'none' } })],
        },
      ],
    },
    {
      id: 'aggregate',
      title: 'Aggregate function',
      configKey: 'chart.chartAggregate.function',
      drawings: [
        {
          label: "function: 'count'",
          children: [counted('chart-agg-count')],
        },
        ...(['sum', 'avg', 'min', 'max'] as const).map((fn) => ({
          label: `function: '${fn}' · field: 'amount'`,
          children: [
            counted(`chart-agg-${fn}`, {
              chartAggregate: { function: fn, field: 'amount', groupBy: 'status' },
            }),
          ],
        })),
      ],
    },
    {
      id: 'axes',
      title: 'Axes',
      configKey: 'chart.xAxis | chart.yAxis',
      drawings: [
        {
          label: 'xAxis: { field, label } · yAxis: { field, label }',
          children: [
            plotted('chart-axis-label', {
              xAxis: { field: 'name', label: 'Specimen' },
              yAxis: { field: 'amount', label: 'Amount' },
            }),
          ],
        },
        ...(['date', 'currency', 'number', 'percent'] as const).map((format) => ({
          label: `yAxis: { format: '${format}' }`,
          children: [plotted(`chart-axis-${format}`, { yAxis: { field: 'amount', format } })],
        })),
        {
          label: "yAxis: { scale: 'logarithmic' }",
          children: [
            plotted('chart-axis-log', { yAxis: { field: 'amount', scale: 'logarithmic' } }),
          ],
        },
        {
          label: 'yAxis: { gridLines: true }',
          children: [plotted('chart-axis-grid', { yAxis: { field: 'amount', gridLines: true } })],
        },
      ],
    },
    {
      id: 'tooltip',
      title: 'Tooltip',
      configKey: 'chart.tooltip.format',
      drawings: [
        {
          label: 'tooltip: absent',
          children: [counted('chart-tooltip-default')],
        },
        {
          label: "tooltip: { format: '{label}: {value}' }",
          children: [counted('chart-tooltip-both', { tooltip: { format: '{label}: {value}' } })],
        },
        {
          label: "tooltip: { format: '{value}' }",
          children: [counted('chart-tooltip-value', { tooltip: { format: '{value}' } })],
        },
      ],
    },
    {
      id: 'group-by',
      title: 'Group by',
      configKey: 'chart.chartAggregate.groupBy',
      drawings: [
        { label: "groupBy: 'status'", children: [counted('chart-group-status')] },
        {
          label: "groupBy: 'priority'",
          children: [
            counted('chart-group-priority', {
              chartAggregate: { function: 'count', groupBy: 'priority' },
            }),
          ],
        },
        {
          label: "groupBy: 'name'",
          children: [
            counted('chart-group-name', { chartAggregate: { function: 'count', groupBy: 'name' } }),
          ],
        },
      ],
    },
    {
      id: 'interval',
      title: 'Interval',
      configKey: 'chart.chartAggregate.interval',
      drawings: (['day', 'week', 'month', 'quarter', 'year'] as const).map((interval) => ({
        label: `interval: '${interval}'`,
        ...(interval === 'month' ? {} : {}),
        children: [
          counted(`chart-interval-${interval}`, {
            chartType: 'line',
            chartAggregate: { function: 'count', groupBy: 'startsAt', interval },
          }),
        ],
      })),
    },
    {
      id: 'empty',
      title: 'Empty',
      configKey: 'chart.emptyMessage',
      drawings: [
        {
          label: "emptyMessage: 'No specimen rows'",
          children: [
            {
              type: 'chart',
              props: { id: 'chart-empty', className: 'w-full' },
              dataSource: {
                system: {
                  endpoint: SPECIMEN_ROWS_ENDPOINT,
                  rowsKey: 'items',
                  query: { rows: '0' },
                },
              },
              chartType: 'bar',
              chartAggregate: { function: 'count', groupBy: 'status' },
              emptyMessage: 'No specimen rows',
            } as PageComponent,
          ],
        },
      ],
    },
  ],
}

export default chart
