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
  stringParam,
  THEME_NOTE,
} from '@/library/manifest/block-kit'
import {
  dashboardHeading,
  dashboardPage,
  dashboardPanel,
  inWindow,
  PERIOD_NOTE,
  periodSelector,
} from '@/library/manifest/dashboard-block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

type Node = Readonly<Record<string, unknown>>
type P = (key: string) => string

/** Three figures, each with the trailing 30 days as a sparkline. */
const figures = (source: Node, p: P): Node => {
  const money = { type: 'currency', options: { currency: p('currency') } }
  const sparkline = { field: p('amountField'), groupBy: p('dateField'), interval: 'day', days: 30 }
  const kpi = (label: string, aggregate: Node, format: Node): Node => ({
    type: 'kpi',
    label,
    dataSource: source,
    kpiAggregate: aggregate,
    kpiFormat: format,
    sparkline,
  })
  return {
    type: 'grid',
    props: { className: 'grid grid-cols-1 gap-4 sm:grid-cols-3' },
    children: [
      kpi('[Revenue]', { function: 'sum', field: p('amountField') }, money),
      kpi('[Orders]', { function: 'count' }, { type: 'number' }),
      kpi('[Average order]', { function: 'avg', field: p('amountField') }, money),
    ],
  }
}

/** The total by category as bars beside each category's share as a donut. */
const breakdowns = (source: Node, p: P): Node => {
  const breakdown = {
    function: 'sum',
    field: p('amountField'),
    groupBy: p('categoryField'),
    order: 'value-desc',
    limit: 5,
    otherLabel: 'Other',
  }
  return {
    type: 'grid',
    props: { className: 'grid grid-cols-1 gap-4 lg:grid-cols-12' },
    children: [
      dashboardPanel(
        '[Revenue] by [category]',
        [{ type: 'chart', chartType: 'bar', dataSource: source, chartAggregate: breakdown }],
        'lg:col-span-7'
      ),
      dashboardPanel(
        'Share of [revenue]',
        [
          {
            type: 'chart',
            chartType: 'donut',
            dataLabels: false,
            dataSource: source,
            chartAggregate: breakdown,
            legend: { position: 'right' },
          },
        ],
        'lg:col-span-5'
      ),
    ],
  }
}

/** Metrics: three figures with their sparklines, the breakdown by category and its share. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'dashboard-metrics',
  title: 'Dashboard metrics',
  category: 'application',
  tags: ['dashboard', 'kpi', 'sparkline', 'chart', 'breakdown', 'donut'],
  description:
    'A metrics page over one of your tables: three figures each with a 30-day sparkline, the total by category as bars, and each category’s share as a donut — the five largest categories named, the rest folded into "Other".',
  notes: [
    PERIOD_NOTE,
    DATA_NOTE,
    'Categories past the fifth fold into one "Other" bar and slice, so the breakdown stays readable however many options the field gains.',
    THEME_NOTE,
  ],
  params: [
    stringParam('headline', 'The page heading.', '[Metrics]'),
    stringParam(
      'sentence',
      'The line under the heading.',
      'Where [orders] come from, over the period.'
    ),
    stringParam('table', 'The table every panel reads.', 'orders'),
    stringParam('dateField', 'The date field the period filters on.', 'ordered_at'),
    stringParam('amountField', 'The number or currency field the figures add up.', 'amount'),
    stringParam('categoryField', 'The single-select field the breakdown groups by.', 'category'),
    stringParam('currency', 'The currency code the figures print in.', 'EUR'),
    stringParam('activityTable', 'The table the activity feed reads.', 'activity'),
    stringParam('actorField', 'The activity field naming who acted.', 'actor'),
    stringParam('summaryField', 'The activity field saying what happened.', 'summary'),
    stringParam('activityTimeField', 'The activity field holding when it happened.', 'happened_at'),
  ],
  tables: [
    {
      param: 'table',
      fields: [
        { name: 'amount', param: 'amountField', type: 'currency' },
        { name: 'ordered_at', param: 'dateField', type: 'date' },
        { name: 'category', param: 'categoryField', type: 'single-select' },
      ],
    },
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    const source = inWindow(p('table'), p('dateField'))
    return asComponent(
      name,
      dashboardPage([
        dashboardHeading(p('headline'), p('sentence'), [periodSelector()]),
        figures(source, p),
        breakdowns(source, p),
      ])
    )
  },
})
