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

/** shadcn/ui's `chart-pie-donut`: each category's share of one figure, drawn as a donut in a centred card. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'chart-pie-donut',
  shadcnBlock: 'chart-pie-donut',
  title: 'Donut chart',
  category: 'shadcn',
  tags: ['chart', 'donut', 'pie', 'share', 'breakdown', 'shadcn'],
  description: 'A donut chart',
  notes: [
    'The block mirrors shadcn/ui’s `chart-pie-donut` chart: a centred card with a title, one line under it, and one number field summed for each option of a single-select field, drawn as a donut. The legend under it names each slice, so the slices carry no label of their own.',
    PLACE_NOTE,
    DATA_NOTE,
    'Each slice takes the colour its option declares, else the next colour of the chart palette, and the slices run largest first.',
    SIX_MONTHS_NOTE,
    CHART_THEME_NOTE,
  ],
  params: [
    stringParam('title', 'The card title.', '[Visitors] by [browser]'),
    stringParam('description', 'The line under the title.', 'The last six months'),
    stringParam('table', 'The table the chart reads.', 'visits'),
    stringParam('dateField', 'The date field the six months are read from.', 'day'),
    stringParam('categoryField', 'The single-select field the slices group by.', 'browser'),
    stringParam('valueField', 'The number field summed for each slice.', 'visitors'),
    stringParam('seriesLabel', 'What the chart calls the summed figure.', '[Visitors]'),
  ],
  tables: [
    {
      param: 'table',
      fields: [
        { name: 'day', param: 'dateField', type: 'date' },
        { name: 'browser', param: 'categoryField', type: 'single-select' },
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
        chartCardHeader(
          p('title'),
          p('description'),
          'grid auto-rows-min items-center justify-items-center gap-2 px-6 text-center'
        ),
        chartCardContent(
          {
            type: 'chart',
            chartType: 'donut',
            dataSource: lastSixMonths(p('table'), p('dateField')),
            chartAggregate: {
              function: 'sum',
              field: p('valueField'),
              groupBy: p('categoryField'),
            },
            series: [{ field: p('valueField'), label: p('seriesLabel') }],
            dataLabels: false,
            legend: { position: 'bottom' },
          },
          'mx-auto w-full max-w-xs flex-1 px-6'
        ),
        'pt-6 pb-0'
      )
    )
  },
})
