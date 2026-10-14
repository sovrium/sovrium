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
} from '@/library/manifest/chart-block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** shadcn/ui's `chart-tooltip-default`: two figures stacked as bars by day, read on hover. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'chart-tooltip-default',
  shadcnBlock: 'chart-tooltip-default',
  title: 'Stacked bars with a tooltip',
  category: 'shadcn',
  tags: ['chart', 'bar', 'stacked', 'tooltip', 'week', 'shadcn'],
  description: 'A stacked bar chart with a legend',
  notes: [
    'The block mirrors shadcn/ui’s `chart-tooltip-default` chart: a card with a title and one line under it, over two number fields stacked as bars, one bar per record over the last seven days, each read in the chart’s tooltip.',
    PLACE_NOTE,
    DATA_NOTE,
    'The chart plots each record as it is, so the table holds one record per day, with both figures on it. Change the `filter` value `$today-6d` in the installed block to read a longer or shorter span.',
    CHART_THEME_NOTE,
  ],
  params: [
    stringParam('title', 'The card title.', '[Visitors] this week'),
    stringParam('description', 'The line under the title.', 'Point at a day to read both figures.'),
    stringParam('table', 'The table the chart reads, one record per day.', 'visits'),
    stringParam('dateField', 'The date field each bar is placed at.', 'day'),
    stringParam('firstField', 'The number field drawn at the foot of each bar.', 'desktop'),
    stringParam('firstLabel', 'What the chart calls the first field.', '[Desktop]'),
    stringParam('secondField', 'The number field stacked on top.', 'mobile'),
    stringParam('secondLabel', 'What the chart calls the second field.', '[Mobile]'),
  ],
  tables: [
    {
      param: 'table',
      fields: [
        { name: 'day', param: 'dateField', type: 'date' },
        { name: 'desktop', param: 'firstField', type: 'decimal' },
        { name: 'mobile', param: 'secondField', type: 'decimal' },
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
          chartType: 'bar',
          dataSource: {
            table: p('table'),
            filter: [{ field: p('dateField'), operator: 'gte', value: '$today-6d' }],
            sort: [{ field: p('dateField'), direction: 'asc' }],
          },
          xAxis: { field: p('dateField'), format: 'date' },
          series: [
            { field: p('firstField'), label: p('firstLabel'), stack: 'total' },
            { field: p('secondField'), label: p('secondLabel'), stack: 'total' },
          ],
          tooltip: { format: '{label}: {value}' },
          legend: { visible: false },
        })
      )
    )
  },
})
