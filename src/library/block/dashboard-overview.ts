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
  activityList,
  dashboardHeading,
  dashboardPage,
  dashboardPanel,
  inWindow,
  PERIOD_NOTE,
  periodSelector,
} from '@/library/manifest/dashboard-block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

type Node = Readonly<Record<string, unknown>>

/** One figure card over the window. */
const figure = (
  source: Node,
  label: string,
  aggregate: Readonly<Record<string, string>>,
  format: Node
): Node => ({
  type: 'kpi',
  label,
  dataSource: source,
  kpiAggregate: aggregate,
  kpiFormat: format,
})

type P = (key: string) => string

/** The four figures: count, total, average and largest over the window. */
const figures = (source: Node, p: P): Node => {
  const money = { type: 'currency', options: { currency: p('currency') } }
  return {
    type: 'grid',
    props: { className: 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4' },
    children: [
      figure(source, '[Orders]', { function: 'count' }, { type: 'number' }),
      figure(source, '[Revenue]', { function: 'sum', field: p('amountField') }, money),
      figure(source, '[Average order]', { function: 'avg', field: p('amountField') }, money),
      figure(source, '[Largest order]', { function: 'max', field: p('amountField') }, money),
    ],
  }
}

/** The total by day beside the recent activity, 8 / 4 on a wide screen. */
const trendAndActivity = (source: Node, p: P): Node => ({
  type: 'grid',
  props: { className: 'grid grid-cols-1 gap-4 lg:grid-cols-12' },
  children: [
    dashboardPanel(
      '[Revenue] by day',
      [
        {
          type: 'chart',
          chartType: 'area',
          dataSource: source,
          chartAggregate: {
            function: 'sum',
            field: p('amountField'),
            groupBy: p('dateField'),
            interval: 'day',
          },
          yAxis: { field: p('amountField'), format: 'currency' },
        },
      ],
      'lg:col-span-8'
    ),
    dashboardPanel(
      'Activity',
      [
        activityList(
          p('activityTable'),
          p('actorField'),
          p('summaryField'),
          p('activityTimeField')
        ),
      ],
      'lg:col-span-4'
    ),
  ],
})

/** The latest eight rows of the window, newest first, read-only. */
const latestRows = (source: Node, p: P): Node => ({
  type: 'table',
  props: { 'aria-label': 'Latest orders' },
  // A reading: the latest rows are not where a record is made or changed.
  readOnly: true,
  dataSource: { ...source, sort: [{ field: p('dateField'), direction: 'desc' }] },
  pagination: { pageSize: 8 },
  columns: [
    { field: p('titleField'), label: '[Reference]', editable: false },
    { field: p('dateField'), label: '[Date]', format: 'short-date', editable: false },
    {
      field: p('amountField'),
      label: '[Amount]',
      align: 'right',
      format: 'currency',
      editable: false,
    },
  ],
  phoneLayout: 'rows',
  emptyMessage: 'No [order] in this period. Choose a longer period to see more.',
})

/** The overview: four figures, the trend by day, recent activity and the latest rows. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'dashboard-overview',
  title: 'Dashboard overview',
  category: 'application',
  tags: ['dashboard', 'kpi', 'chart', 'activity', 'overview', 'period'],
  description:
    'A dashboard home over one of your tables: a period selector, four figures (count, total, average, largest), the total by day, the recent activity and the latest eight rows — every panel narrowed by the chosen period.',
  notes: [
    PERIOD_NOTE,
    DATA_NOTE,
    'A figure with no record in the period reads `—`, never `0`, so "nothing yet" and "zero" stay distinct.',
    THEME_NOTE,
  ],
  params: [
    stringParam('headline', 'The page heading.', '[Overview]'),
    stringParam('sentence', 'The line under the heading.', 'How [orders] moved over the period.'),
    stringParam('table', 'The table every panel reads.', 'orders'),
    stringParam('dateField', 'The date field the period filters on.', 'ordered_at'),
    stringParam('amountField', 'The number or currency field the figures add up.', 'amount'),
    stringParam('categoryField', 'The single-select field the breakdown groups by.', 'category'),
    stringParam('currency', 'The currency code the figures print in.', 'EUR'),
    stringParam('activityTable', 'The table the activity feed reads.', 'activity'),
    stringParam('actorField', 'The activity field naming who acted.', 'actor'),
    stringParam('summaryField', 'The activity field saying what happened.', 'summary'),
    stringParam('activityTimeField', 'The activity field holding when it happened.', 'happened_at'),
    stringParam('titleField', 'The text field the latest-rows table leads with.', 'reference'),
  ],
  tables: [
    {
      param: 'table',
      fields: [
        { name: 'reference', param: 'titleField', type: 'single-line-text' },
        { name: 'amount', param: 'amountField', type: 'currency' },
        { name: 'ordered_at', param: 'dateField', type: 'date' },
      ],
    },
    {
      param: 'activityTable',
      fields: [
        { name: 'actor', param: 'actorField', type: 'single-line-text' },
        { name: 'summary', param: 'summaryField', type: 'single-line-text' },
        { name: 'happened_at', param: 'activityTimeField', type: 'datetime' },
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
        trendAndActivity(source, p),
        dashboardPanel('Latest [orders]', [latestRows(source, p)]),
      ])
    )
  },
})
