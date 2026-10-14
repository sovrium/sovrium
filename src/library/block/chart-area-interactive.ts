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
import { inWindow, PERIOD_NOTE, periodSelector } from '@/library/manifest/dashboard-block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

type Node = Readonly<Record<string, unknown>>
type P = (key: string) => string

/** The header: title and line on the left, the period selector on the right, ruled below. */
const header = (p: P): Node => ({
  type: 'flex',
  props: {
    'data-slot': 'card-header',
    className:
      'flex flex-col items-stretch gap-4 border-b border-border px-6 py-5 sm:flex-row sm:items-center',
  },
  children: [chartCardHeader(p('title'), p('description'), 'grid flex-1 gap-1'), periodSelector()],
})

/** Two number fields, one point per record, stacked as areas over the period. */
const chart = (p: P): Node => ({
  type: 'chart',
  chartType: 'area',
  dataSource: {
    ...inWindow(p('table'), p('dateField')),
    sort: [{ field: p('dateField'), direction: 'asc' }],
  },
  xAxis: { field: p('dateField'), format: 'date' },
  yAxis: { field: p('firstField'), gridLines: true },
  series: [
    { field: p('secondField'), label: p('secondLabel'), stack: 'total', fillOpacity: 0.4 },
    { field: p('firstField'), label: p('firstLabel'), stack: 'total', fillOpacity: 0.4 },
  ],
  legend: { position: 'bottom' },
})

/** shadcn/ui's `chart-area-interactive`: two figures stacked by day, over a chosen period. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'chart-area-interactive',
  shadcnBlock: 'chart-area-interactive',
  title: 'Area chart with a period',
  category: 'shadcn',
  tags: ['chart', 'area', 'stacked', 'period', 'dashboard', 'shadcn'],
  description: 'An interactive area chart',
  notes: [
    'The block mirrors shadcn/ui’s `chart-area-interactive` chart: a card whose header holds the title, one line under it and a period selector, over two number fields stacked as areas, one point per record, with a legend that hides and shows each field.',
    PLACE_NOTE,
    DATA_NOTE,
    'The chart plots each record as it is, so the table holds one record per day, with both figures on it.',
    PERIOD_NOTE,
    CHART_THEME_NOTE,
  ],
  params: [
    stringParam('title', 'The card title.', '[Visitors]'),
    stringParam('description', 'The line under the title.', 'Each day of the period'),
    stringParam('table', 'The table the chart reads, one record per day.', 'visits'),
    stringParam('dateField', 'The date field each record is plotted at.', 'day'),
    stringParam('firstField', 'The number field stacked on top.', 'desktop'),
    stringParam('firstLabel', 'What the legend calls the first field.', '[Desktop]'),
    stringParam('secondField', 'The number field drawn underneath.', 'mobile'),
    stringParam('secondLabel', 'What the legend calls the second field.', '[Mobile]'),
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
      chartCard(header(p), chartCardContent(chart(p), 'px-2 sm:px-6'), 'pt-0 pb-6')
    )
  },
})
