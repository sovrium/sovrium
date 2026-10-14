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

/** One point per record, placed by two number fields, in the chart gallery's card. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'chart-scatter',
  shadcnBlock: null,
  title: 'Scatter chart',
  category: 'application',
  tags: ['chart', 'scatter', 'correlation', 'points'],
  description:
    'A scatter chart: one point per record, placed by two of its number fields, in the same card as the other charts.',
  notes: [
    'No shadcn counterpart: shadcn/ui’s chart gallery has no scatter chart, so this block draws the `scatter` chart type in the gallery’s card — a title, one line under it, then the chart.',
    PLACE_NOTE,
    DATA_NOTE,
    SIX_MONTHS_NOTE,
    CHART_THEME_NOTE,
  ],
  params: [
    stringParam('title', 'The card title.', '[Desktop] against [mobile]'),
    stringParam(
      'description',
      'The line under the title.',
      'One point per day, the last six months'
    ),
    stringParam('table', 'The table the chart reads.', 'visits'),
    stringParam('dateField', 'The date field the six months are read from.', 'day'),
    stringParam('xField', 'The number field read along the bottom.', 'desktop'),
    stringParam('xLabel', 'What the bottom axis is called.', '[Desktop]'),
    stringParam('yField', 'The number field read up the side.', 'mobile'),
    stringParam('yLabel', 'What the chart calls the points.', '[Mobile]'),
  ],
  tables: [
    {
      param: 'table',
      fields: [
        { name: 'day', param: 'dateField', type: 'date' },
        { name: 'desktop', param: 'xField', type: 'decimal' },
        { name: 'mobile', param: 'yField', type: 'decimal' },
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
          chartType: 'scatter',
          dataSource: lastSixMonths(p('table'), p('dateField')),
          xAxis: { field: p('xField'), label: p('xLabel'), gridLines: true },
          yAxis: { field: p('yField'), gridLines: true },
          series: [{ field: p('yField'), label: p('yLabel') }],
          tooltip: { format: '{label}: {value}' },
        })
      )
    )
  },
})
