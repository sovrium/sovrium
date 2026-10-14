/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  asComponent,
  DATA_NOTE,
  param,
  PLACE_NOTE,
  stringParam,
} from '@/library/manifest/block-kit'
import {
  CHART_THEME_NOTE,
  chartCard,
  chartCardContent,
  chartCardHeader,
  lastSixMonths,
  SIX_MONTHS_NOTE,
} from '@/library/manifest/chart-block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** shadcn/ui's `chart-line-default`: one figure summed by month, drawn as a line in a card. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'chart-line-default',
  shadcnBlock: 'chart-line-default',
  title: 'Line chart',
  category: 'shadcn',
  tags: ['chart', 'line', 'trend', 'month', 'shadcn'],
  description: 'A line chart',
  notes: [
    'The block mirrors shadcn/ui’s `chart-line-default` chart: a card with a title, one line under it, and one number field summed by month and drawn as a line.',
    PLACE_NOTE,
    DATA_NOTE,
    SIX_MONTHS_NOTE,
    CHART_THEME_NOTE,
  ],
  params: [
    stringParam('title', 'The card title.', '[Visitors] by month'),
    stringParam('description', 'The line under the title.', 'The last six months'),
    stringParam('table', 'The table the chart reads.', 'visits'),
    stringParam('dateField', 'The date field the months are read from.', 'day'),
    stringParam('valueField', 'The number field summed for each month.', 'visitors'),
    stringParam('seriesLabel', 'What the chart calls the summed figure.', '[Visitors]'),
  ],
  tables: [
    {
      param: 'table',
      fields: [
        { name: 'day', param: 'dateField', type: 'date' },
        { name: 'visitors', param: 'valueField', type: 'decimal' },
      ],
    },
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(
      name,
      chartCard(
        chartCardHeader(p('title'), p('description')),
        chartCardContent({
          type: 'chart',
          chartType: 'line',
          dataSource: lastSixMonths(p('table'), p('dateField')),
          chartAggregate: {
            function: 'sum',
            field: p('valueField'),
            groupBy: p('dateField'),
            interval: 'month',
          },
          series: [{ field: p('valueField'), label: p('seriesLabel') }],
          xAxis: { field: p('dateField'), format: 'date' },
          yAxis: { field: p('valueField'), gridLines: true },
          tooltip: { format: '{label}: {value}' },
          legend: { visible: false },
        })
      )
    )
  },
})
