/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { asComponent, DATA_NOTE, param, stringParam } from '@/library/manifest/block-kit'
import { CHART_THEME_NOTE } from '@/library/manifest/chart-block-kit'
import { inWindow, PERIOD_NOTE, periodSelector } from '@/library/manifest/dashboard-block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'
import { brandRow, userRow } from '@/library/manifest/navigation-block-kit'
import {
  SHELL_NOTES,
  shellHeader,
  shellInset,
  shellLayout,
  shellSidebar,
} from '@/library/manifest/sidebar-shell-block-kit'
import type { BlockNode } from '@/library/manifest/block-kit'

type P = (key: string) => string
type Entry = readonly [label: string, icon: string, href: string]

const MAIN: readonly Entry[] = [
  ['Dashboard', 'layout-dashboard', '/dashboard'],
  ['Lifecycle', 'list', '/lifecycle'],
  ['Analytics', 'chart-bar', '/analytics'],
  ['Projects', 'folder', '/projects'],
  ['Team', 'users', '/team'],
]

const DOCUMENTS: readonly Entry[] = [
  ['Data Library', 'database', '/documents/data-library'],
  ['Reports', 'file-chart-column', '/documents/reports'],
  ['Word Assistant', 'file-text', '/documents/word-assistant'],
]

const SECONDARY: readonly Entry[] = [
  ['Settings', 'settings', '/settings'],
  ['Get Help', 'circle-help', '/help'],
  ['Search', 'search', '/search'],
]

const entries = (list: readonly Entry[]): readonly Readonly<Record<string, unknown>>[] =>
  list.map(([label, icon, href]) => ({ label, icon, href }))

/** `AppSidebar`: the main entries, the documents with their "More" control, help at the foot. */
const sidebar = (): BlockNode =>
  shellSidebar({
    collapsible: 'offcanvas',
    variant: 'inset',
    header: [brandRow('Acme Inc.', 'Workspace', 'command', '/dashboard')],
    groups: [
      { items: entries(MAIN) },
      {
        label: 'Documents',
        items: DOCUMENTS.map(([label, icon, href]) => ({
          label,
          icon,
          href,
          menuAction: { icon: 'ellipsis', label: `More for ${label}`, href },
        })),
      },
      { items: entries(SECONDARY) },
    ],
    footer: [userRow('shadcn', 'm@example.com', 'CN')],
  })

/** One `SectionCards` card: the figure under its label, and a line in the card's footer. */
const sectionCard = (
  p: P,
  label: string,
  aggregate: Readonly<Record<string, string>>
): BlockNode => ({
  type: 'card',
  footer: [
    {
      type: 'text',
      element: 'p',
      props: { className: 'text-sm text-muted-foreground' },
      content: p('cardsLine'),
    },
  ],
  children: [
    {
      type: 'kpi',
      label,
      dataSource: inWindow(p('table'), p('dateField')),
      kpiAggregate: aggregate,
      kpiFormat: { type: 'number' },
      props: { className: 'border-0 bg-transparent p-0 shadow-none [--card-spacing:0px]!' },
    },
  ],
})

/** `SectionCards`: four figures over the period, one column on a phone, four on a wide screen. */
const sectionCards = (p: P): BlockNode => ({
  type: 'grid',
  props: {
    className: 'grid grid-cols-1 gap-4 px-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 lg:px-6',
  },
  children: [
    sectionCard(p, '[Total visitors]', { function: 'sum', field: p('firstField') }),
    sectionCard(p, '[Mobile visitors]', { function: 'sum', field: p('secondField') }),
    sectionCard(p, '[Busiest day]', { function: 'max', field: p('firstField') }),
    sectionCard(p, '[Days recorded]', { function: 'count' }),
  ],
})

/** `ChartAreaInteractive`: both figures stacked by day, the period selector in the card's action. */
const areaChart = (p: P): BlockNode => ({
  type: 'card',
  title: p('chartTitle'),
  description: 'Each day of the period',
  action: periodSelector(),
  props: { className: 'mx-4 lg:mx-6' },
  children: [
    {
      type: 'chart',
      chartType: 'area',
      dataSource: {
        ...inWindow(p('table'), p('dateField')),
        sort: [{ field: p('dateField'), direction: 'asc' }],
      },
      xAxis: { field: p('dateField'), format: 'date' },
      yAxis: { field: p('firstField'), gridLines: true },
      series: [
        { field: p('secondField'), label: '[Mobile]', stack: 'total', fillOpacity: 0.4 },
        { field: p('firstField'), label: '[Desktop]', stack: 'total', fillOpacity: 0.4 },
      ],
      legend: { position: 'bottom' },
    },
  ],
})

/** `DataTable`: the documents, read here and edited on their own page. */
const documentsTable = (p: P): BlockNode => ({
  type: 'container',
  props: { className: 'px-4 lg:px-6' },
  children: [
    {
      type: 'table',
      props: { 'aria-label': 'Documents' },
      readOnly: true,
      dataSource: { table: p('documentsTable') },
      pagination: { pageSize: 10 },
      columns: [
        { field: p('headerField'), label: 'Header', editable: false },
        { field: p('typeField'), label: 'Section type', editable: false },
        { field: p('statusField'), label: 'Status', editable: false },
        { field: p('reviewerField'), label: 'Reviewer', editable: false },
      ],
      phoneLayout: 'rows',
      emptyMessage: 'No documents yet. Add the first one on the documents page.',
    },
  ],
})

/** The inset's content: the cards, the chart and the table, one column. */
const content = (p: P): BlockNode => ({
  type: 'flex',
  props: { className: '@container/main flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6' },
  children: [sectionCards(p), areaChart(p), documentsTable(p)],
})

/** shadcn/ui's `dashboard-01`, composed in config. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'dashboard-01',
  shadcnBlock: 'dashboard-01',
  title: 'Dashboard 01',
  category: 'shadcn',
  tags: ['dashboard', 'sidebar', 'kpi', 'chart', 'table', 'period', 'shadcn'],
  description: 'A dashboard with sidebar, charts and data table.',
  notes: [
    'An inset sidebar beside the dashboard: four figure cards, an area chart of two figures stacked by day with its period selector, and a table of documents.',
    DATA_NOTE,
    PERIOD_NOTE,
    'The cards and the chart read one table holding one record per day with both figures on it; the table reads a second table of documents.',
    ...SHELL_NOTES,
    CHART_THEME_NOTE,
  ],
  params: [
    stringParam('title', 'The title in the bar across the top.', 'Documents'),
    stringParam('table', 'The table the cards and the chart read, one record per day.', 'visits'),
    stringParam('dateField', 'The date field each record is plotted at.', 'day'),
    stringParam('firstField', 'The number field stacked on top.', 'desktop'),
    stringParam('secondField', 'The number field drawn underneath.', 'mobile'),
    stringParam('cardsLine', 'The line under each figure card.', 'Over the chosen period'),
    stringParam('chartTitle', 'The chart card title.', '[Total visitors]'),
    stringParam('documentsTable', 'The table the data table lists.', 'documents'),
    stringParam('headerField', 'The text field each row leads with.', 'header'),
    stringParam('typeField', 'The field naming the section type.', 'section_type'),
    stringParam('statusField', 'The field holding the status.', 'status'),
    stringParam('reviewerField', 'The field naming the reviewer.', 'reviewer'),
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
    {
      param: 'documentsTable',
      fields: [
        { name: 'header', param: 'headerField', type: 'single-line-text' },
        { name: 'section_type', param: 'typeField', type: 'single-line-text' },
        { name: 'status', param: 'statusField', type: 'single-line-text' },
        { name: 'reviewer', param: 'reviewerField', type: 'single-line-text' },
      ],
    },
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(
      name,
      shellLayout(
        [
          sidebar(),
          shellInset(
            [
              shellHeader([
                {
                  type: 'text',
                  element: 'h1',
                  props: { className: 'text-base font-medium text-foreground' },
                  content: p('title'),
                },
              ]),
              content(p),
            ],
            true
          ),
        ],
        true
      )
    )
  },
})
