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
} from '@/library/manifest/dashboard-block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

type Node = Readonly<Record<string, unknown>>

/** The grid of one tab: the rows, a click opens the record beside the list. */
const worklistGrid = (source: Node, columns: readonly Node[], drawerId: string): Node => ({
  type: 'table',
  dataSource: source,
  columns,
  onRowClick: { action: 'openDrawer', component: drawerId },
  phoneLayout: 'rows',
  pagination: { pageSize: 25 },
  emptyMessage: 'Nothing here. New [orders] land in this list.',
})

type P = (key: string) => string

/** The figures for the view the reader works from. */
const figures = (view: Node, p: P): Node => {
  const money = { type: 'currency', options: { currency: p('currency') } }
  const kpi = (label: string, aggregate: Node, format: Node): Node => ({
    type: 'kpi',
    label,
    dataSource: view,
    kpiAggregate: aggregate,
    kpiFormat: format,
  })
  return {
    type: 'grid',
    props: { className: 'grid grid-cols-1 gap-4 sm:grid-cols-3' },
    children: [
      kpi('[Open]', { function: 'count' }, { type: 'number' }),
      kpi('[Value open]', { function: 'sum', field: p('amountField') }, money),
      kpi('[Average]', { function: 'avg', field: p('amountField') }, money),
    ],
  }
}

/** One tab for the view, one for every row. */
const tabbedGrids = (view: Node, p: P, drawerId: string): Node => {
  const columns: readonly Node[] = [
    { field: p('titleField'), label: '[Reference]', editable: false },
    { field: p('dateField'), label: '[Date]', format: 'short-date', editable: false },
    { field: p('categoryField'), label: '[Category]', editable: false },
    {
      field: p('amountField'),
      label: '[Amount]',
      align: 'right',
      format: 'currency',
      editable: false,
    },
  ]
  return {
    type: 'container',
    props: { className: 'min-w-0 lg:col-span-8' },
    children: [
      {
        type: 'tabs',
        defaultTab: 'view',
        panels: [
          { id: 'view', label: p('viewLabel') },
          { id: 'all', label: 'All' },
        ],
        children: [
          worklistGrid(view, columns, drawerId),
          worklistGrid({ table: p('table') }, columns, drawerId),
        ],
      },
    ],
  }
}

/** The side panel a row opens: the record's fields, editable in place. */
const detailDrawer = (drawerId: string, p: P): Node => ({
  type: 'drawer',
  id: drawerId,
  props: { title: '[Order]' },
  drawerSide: 'right',
  drawerSize: 'md',
  dataSource: { table: p('table') },
  canEdit: true,
  recordFields: [
    { name: p('titleField'), type: 'single-line-text', label: '[Reference]' },
    { name: p('dateField'), type: 'date', label: '[Date]' },
    { name: p('amountField'), type: 'currency', label: '[Amount]' },
  ],
})

/** The worklist: the rows to get through, split by view, with the figures that matter. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'dashboard-worklist',
  title: 'Dashboard worklist',
  category: 'application',
  tags: ['dashboard', 'worklist', 'queue', 'tabs', 'view', 'kpi'],
  description:
    'A working dashboard over one of your tables: a "New" button, three figures for the view you work from, and tabs between that view and every row — a row opens the record in a side panel.',
  notes: [
    'The first tab reads the view `view` names — declare it under the table’s `views`, with the filter that makes it a worklist (open, unassigned, overdue). The second tab reads the whole table.',
    DATA_NOTE,
    'The "New" button opens a dialog with the form the block installs beside it, in your `forms`. Add the fields your records need to that form.',
    THEME_NOTE,
  ],
  params: [
    stringParam('headline', 'The page heading.', '[Orders]'),
    stringParam('sentence', 'The line under the heading.', 'What needs doing next.'),
    stringParam('table', 'The table the worklist reads.', 'orders'),
    stringParam('view', 'The view the first tab and the figures read.', 'open-orders'),
    stringParam('viewLabel', 'The first tab’s label.', '[Open]'),
    stringParam('titleField', 'The text field each row leads with.', 'reference'),
    stringParam('dateField', 'The date field shown on each row.', 'ordered_at'),
    stringParam('amountField', 'The number or currency field the figures add up.', 'amount'),
    stringParam('categoryField', 'A single-select field shown as each row’s chip.', 'category'),
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
        { name: 'reference', param: 'titleField', type: 'single-line-text' },
        { name: 'ordered_at', param: 'dateField', type: 'date' },
        { name: 'amount', param: 'amountField', type: 'currency' },
        { name: 'category', param: 'categoryField', type: 'single-select' },
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
  forms: ({ name, params }) => {
    const p = param(params)
    return [
      {
        name: `${name}-new`,
        title: 'New [order]',
        submitTo: { table: p('table') },
        fields: [
          { kind: 'table-field', column: p('titleField'), label: '[Reference]' },
          { kind: 'table-field', column: p('dateField'), label: '[Date]' },
          { kind: 'table-field', column: p('amountField'), label: '[Amount]' },
        ],
        onSuccess: { type: 'toast', message: '[Order] added.', variant: 'success' },
      },
    ]
  },
  build: ({ name, params }) => {
    const p = param(params)
    const view = { table: p('table'), view: p('view') }
    const drawerId = `${name}-detail`
    const dialogId = `${name}-new-dialog`
    return asComponent(
      name,
      dashboardPage([
        dashboardHeading(p('headline'), p('sentence'), [
          {
            type: 'button',
            props: { label: 'New [order]', interactions: { click: { modal: dialogId } } },
          },
        ]),
        figures(view, p),
        {
          type: 'grid',
          props: { className: 'grid grid-cols-1 gap-4 lg:grid-cols-12' },
          children: [
            tabbedGrids(view, p, drawerId),
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
        },
        detailDrawer(drawerId, p),
        {
          type: 'dialog',
          props: {
            id: dialogId,
            title: 'New [order]',
            description: 'It joins the list as soon as you add it.',
          },
          formRef: `${name}-new`,
        },
      ])
    )
  },
})
