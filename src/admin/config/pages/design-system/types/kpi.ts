/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `kpi` — one number, and what a reader needs to judge it.
//
// The drawings are amounts of context, and the choice between them is editorial
// rather than visual. A bare number answers "how many". A delta answers "is that
// good", which a bare number never can.
//
// ─── WHY THERE IS NO SPARKLINE HERE ────────────────────────────────────────
//
// The reference draws a third board with a trailing sparkline. A sparkline plots
// ROWS, and this type has two bindings: a declared table, which hands it rows to
// plot, and a read endpoint, which hands it one pre-computed scalar and nothing
// to plot. This console declares no table — that is the specimen bound, not an
// omission — so `sparkline` here is REFUSED at load rather
// than drawn empty — the pair is rejected with a message naming both halves,
// which is the fix for a trend line an author could not tell from a flat one.
// Over one of your tables it draws: give it the field, the date field to group
// by, the interval, and the trailing window.

import { SPECIMEN_ROWS_ENDPOINT, SPECIMEN_TABLE_NAME } from '../../../system-sources'
import type { PageComponent, TypePageBody } from './body-shape'

const SCALAR = { system: { endpoint: SPECIMEN_ROWS_ENDPOINT, valuePath: 'total' } }

/**
 * The catalogue fixture as a TABLE, which is what a trend line and an aggregate
 * need and a scalar endpoint cannot give them.
 *
 * The endpoint hands this type ONE pre-computed number. A sparkline plots rows
 * and an aggregate reduces them, so both were refused here for as long as this
 * console declared no table — and that refusal was correct, not a gap. It is
 * spent now: the platform serves its own fixture under a reserved table name,
 * so the console can bind rows without binding anything of yours, which is what
 * the confidentiality bound actually forbids.
 */
const ROWS = { table: SPECIMEN_TABLE_NAME }

/** The same scalar every time, with one key changed. */
const tile = (id: string, extra: Readonly<Record<string, unknown>>) =>
  ({
    type: 'kpi' as const,
    props: { id },
    dataSource: SCALAR,
    label: 'Specimen rows',
    ...extra,
  }) as PageComponent

const kpi: TypePageBody = {
  drawings: [
    {
      label: 'single',
      children: [
        {
          type: 'kpi',
          props: { id: 'design-system-kpi-single' },
          dataSource: SCALAR,
          label: 'Specimen rows',
          kpiFormat: { type: 'number' },
        },
      ],
    },
    {
      label: 'with delta',
      children: [
        {
          type: 'kpi',
          props: { id: 'design-system-kpi-delta' },
          dataSource: SCALAR,
          label: 'Specimen rows',
          kpiFormat: { type: 'number' },
          trend: {
            comparisonPeriod: 'previousMonth',
            direction: 'up',
            changePercent: 12,
            color: 'green',
          },
        },
      ],
    },
    {
      label: 'with sparkline',
      children: [
        {
          type: 'kpi',
          props: { id: 'design-system-kpi-sparkline' },
          dataSource: ROWS,
          label: 'Specimen amounts',
          kpiFormat: { type: 'currency' },
          kpiAggregate: { function: 'sum', field: 'amount' },
          sparkline: { field: 'amount', groupBy: 'startsAt', interval: 'day', days: 30 },
        },
      ],
    },
  ],
  options: [
    {
      id: 'sparkline',
      title: 'Sparkline',
      configKey: 'kpi.sparkline',
      drawings: [
        {
          label: "sparkline: { interval: 'day', days: 30 }",
          children: [
            {
              type: 'kpi',
              props: { id: 'design-system-kpi-spark-day' },
              dataSource: ROWS,
              label: 'Specimen amounts',
              kpiFormat: { type: 'currency' },
              kpiAggregate: { function: 'sum', field: 'amount' },
              sparkline: { field: 'amount', groupBy: 'startsAt', interval: 'day', days: 30 },
            } as PageComponent,
          ],
        },
        {
          label: "sparkline: { interval: 'week', days: 90 }",
          children: [
            {
              type: 'kpi',
              props: { id: 'design-system-kpi-spark-week' },
              dataSource: ROWS,
              label: 'Specimen amounts',
              kpiFormat: { type: 'currency' },
              kpiAggregate: { function: 'sum', field: 'amount' },
              sparkline: { field: 'amount', groupBy: 'startsAt', interval: 'week', days: 90 },
            } as PageComponent,
          ],
        },
      ],
    },
    {
      id: 'aggregate',
      title: 'Aggregate function',
      configKey: 'kpi.kpiAggregate',
      drawings: [
        {
          label: "kpiAggregate: { function: 'count' }",
          children: [
            {
              type: 'kpi',
              props: { id: 'design-system-kpi-agg-count' },
              dataSource: ROWS,
              label: 'Specimen rows',
              kpiFormat: { type: 'number' },
              kpiAggregate: { function: 'count' },
            } as PageComponent,
          ],
        },
        {
          label: "kpiAggregate: { function: 'sum', field: 'amount' }",
          children: [
            {
              type: 'kpi',
              props: { id: 'design-system-kpi-agg-sum' },
              dataSource: ROWS,
              label: 'Total amount',
              kpiFormat: { type: 'currency' },
              kpiAggregate: { function: 'sum', field: 'amount' },
            } as PageComponent,
          ],
        },
        {
          label: "kpiAggregate: { function: 'avg', field: 'amount' }",
          children: [
            {
              type: 'kpi',
              props: { id: 'design-system-kpi-agg-avg' },
              dataSource: ROWS,
              label: 'Average amount',
              kpiFormat: { type: 'currency' },
              kpiAggregate: { function: 'avg', field: 'amount' },
            } as PageComponent,
          ],
        },
        {
          label: "kpiAggregate: { function: 'max', field: 'amount' }",
          children: [
            {
              type: 'kpi',
              props: { id: 'design-system-kpi-agg-max' },
              dataSource: ROWS,
              label: 'Largest amount',
              kpiFormat: { type: 'currency' },
              kpiAggregate: { function: 'max', field: 'amount' },
            } as PageComponent,
          ],
        },
      ],
    },
    {
      id: 'format',
      title: 'Format',
      configKey: 'kpi.kpiFormat.type',
      drawings: (['number', 'currency', 'percentage', 'compact', 'bytes'] as const).map((type) => ({
        label: `kpiFormat: { type: '${type}' }`,
        children: [tile(`kpi-fmt-${type}`, { kpiFormat: { type } })],
      })),
    },
    {
      id: 'trend',
      title: 'Trend',
      configKey: 'kpi.trend',
      drawings: [
        {
          label: "trend: { direction: 'up', color: 'green' }",
          children: [
            tile('kpi-trend-up', {
              kpiFormat: { type: 'number' },
              trend: {
                comparisonPeriod: 'previousMonth',
                direction: 'up',
                changePercent: 12,
                color: 'green',
              },
            }),
          ],
        },
        {
          label: "trend: { direction: 'down', color: 'red' }",
          children: [
            tile('kpi-trend-down', {
              kpiFormat: { type: 'number' },
              trend: {
                comparisonPeriod: 'previousMonth',
                direction: 'down',
                changePercent: 8,
                color: 'red',
              },
            }),
          ],
        },
        {
          label: "trend: { direction: 'flat', color: 'gray' }",
          children: [
            tile('kpi-trend-flat', {
              kpiFormat: { type: 'number' },
              trend: {
                comparisonPeriod: 'previousMonth',
                direction: 'flat',
                changePercent: 0,
                color: 'gray',
              },
            }),
          ],
        },
      ],
    },
    {
      id: 'thresholds',
      title: 'Thresholds',
      configKey: 'kpi.thresholds[]',
      drawings: [
        {
          label: 'thresholds: [{ value: 2, color }, { value: 3, color }]',
          children: [
            tile('kpi-thr', {
              kpiFormat: { type: 'number' },
              thresholds: [
                { value: 2, color: 'yellow' },
                { value: 3, color: 'red' },
              ],
            }),
          ],
        },
      ],
    },
    {
      id: 'icon',
      title: 'Icon',
      configKey: 'kpi.icon',
      drawings: [
        {
          label: "icon: 'receipt'",
          children: [tile('kpi-icon', { kpiFormat: { type: 'number' }, icon: 'receipt' })],
        },
      ],
    },
    {
      id: 'source',
      title: 'Source',
      configKey: 'kpi.dataSource.valuePath | valueTemplate',
      drawings: [
        {
          label: "valuePath: 'total'",
          children: [tile('kpi-src-path', { kpiFormat: { type: 'number' } })],
        },
        {
          label: "valueTemplate: '{total} of {total}'",
          children: [
            {
              type: 'kpi',
              props: { id: 'kpi-src-template' },
              dataSource: {
                system: { endpoint: SPECIMEN_ROWS_ENDPOINT, valueTemplate: '{total} of {total}' },
              },
              label: 'Specimen rows',
            } as PageComponent,
          ],
        },
        {
          label: 'kpiAggregate: { function, field }',
          children: [
            {
              type: 'code',
              props: { language: 'yaml' },
              content:
                'dataSource:\n  table: deals\nkpiAggregate:\n  function: sum\n  field: amount',
            } as PageComponent,
          ],
        },
      ],
    },
  ],
}

export default kpi
