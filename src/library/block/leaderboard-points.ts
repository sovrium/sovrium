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

/**
 * A monthly leaderboard: the members with the most points since the first day
 * of the month, highest first, read from the points ledger the
 * `record-to-points` recipe fills. A bar chart in a card, so it follows the
 * app's chart palette like the shadcn chart blocks.
 */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'leaderboard-points',
  shadcnBlock: null,
  title: 'Monthly points leaderboard',
  category: 'community',
  tags: ['leaderboard', 'points', 'ranking', 'community', 'chart'],
  description:
    'A card ranking the members with the most points this month, highest first, from your points ledger.',
  notes: [
    'The block sums the `pointsField` of the ledger table named by `table` for each member in `memberField`, counting only the rows whose `dateField` falls on or after the first day of the current month (`$startOfMonth`, the server’s UTC day), and draws the ten highest as bars, highest first.',
    'It pairs with the `record-to-points` recipe, which adds a ledger row each time a member earns points. Change `limit` in the installed block to rank more or fewer members, or the filter value to rank another period.',
    PLACE_NOTE,
    DATA_NOTE,
    CHART_THEME_NOTE,
  ],
  params: [
    stringParam('title', 'The card title.', 'Leaderboard'),
    stringParam('description', 'The line under the title.', 'Points earned this month'),
    stringParam('table', 'The points ledger table.', 'points'),
    stringParam('memberField', 'The field naming the member who earned the points.', 'member_name'),
    stringParam('pointsField', 'The number field summed for each member.', 'points'),
    stringParam('dateField', 'The date the points were earned.', 'earned_at'),
  ],
  tables: [
    {
      param: 'table',
      fields: [
        { name: 'member_name', param: 'memberField', type: 'single-line-text' },
        { name: 'points', param: 'pointsField', type: 'integer' },
        { name: 'earned_at', param: 'dateField', type: 'datetime' },
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
            filter: [{ field: p('dateField'), operator: 'gte', value: '$startOfMonth' }],
          },
          chartAggregate: {
            function: 'sum',
            field: p('pointsField'),
            groupBy: p('memberField'),
            order: 'value-desc',
            limit: 10,
          },
          series: [{ field: p('pointsField'), label: 'Points' }],
          xAxis: { field: p('memberField') },
          yAxis: { field: p('pointsField'), gridLines: true },
          tooltip: { format: '{label}: {value}' },
          legend: { visible: false },
        })
      )
    )
  },
})
