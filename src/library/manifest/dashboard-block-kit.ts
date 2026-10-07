/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What the DASHBOARD blocks share: one table (or one view of it) feeds every
 * panel, and the page's `window` — the period selector at the top — narrows
 * every panel at once.
 *
 * ─── THE PERIOD IS THE PAGE'S, NOT THE BLOCK'S ─────────────────────────────
 *
 * A block cannot declare a page key, so the selector draws three links that
 * set `?period=` and each panel filters on `$window.start` / `$window.end`.
 * The page that places the block declares `window` with the presets the
 * selector links to. Resolving the period once per render, for the whole page,
 * is what keeps two panels from ever reporting two different periods.
 */

import type { BlockNode } from './block-kit'

/** The presets the selector links to; the page's `window.presets` must list them. */
export const PERIOD_PRESETS: readonly (readonly [string, string])[] = [
  ['7d', '7 days'],
  ['30d', '30 days'],
  ['90d', '90 days'],
]

/** The segmented period selector: one link per preset, the active one marked current. */
export const periodSelector = (): BlockNode => ({
  type: 'container',
  element: 'nav',
  props: {
    'aria-label': 'Period',
    className: 'flex w-fit items-center gap-0.5 rounded-md border border-border p-0.5',
  },
  children: PERIOD_PRESETS.map(([id, label]) => ({
    type: 'link',
    content: label,
    props: {
      href: `?period=${id}`,
      className:
        'rounded px-2.5 py-1 text-sm font-medium text-foreground-muted hover:text-foreground',
    },
    activeWhen: { value: '$window.id', equals: id },
    activeProps: {
      'aria-current': 'page',
      className: 'rounded bg-background-raised px-2.5 py-1 text-sm font-medium text-foreground',
    },
  })),
})

/** The records of `table` whose `dateField` falls in the page's window. */
export const inWindow = (table: string, dateField: string): BlockNode => ({
  table,
  filter: [
    { field: dateField, operator: 'gte', value: '$window.start' },
    { field: dateField, operator: 'lte', value: '$window.end' },
  ],
})

/** A dashboard heading row: title and one sentence left, the selector right. */
export const dashboardHeading = (
  title: string,
  sentence: string,
  side: readonly BlockNode[]
): BlockNode => ({
  type: 'flex',
  props: { className: 'flex flex-wrap items-end justify-between gap-4' },
  children: [
    {
      type: 'flex',
      props: { className: 'flex flex-col gap-1' },
      children: [
        {
          type: 'text',
          element: 'h1',
          props: { className: 'text-2xl font-semibold tracking-tight text-foreground' },
          content: title,
        },
        {
          type: 'text',
          element: 'p',
          props: { className: 'text-md text-foreground-muted' },
          content: sentence,
        },
      ],
    },
    ...side,
  ],
})

/** A bordered panel with a small heading, holding one data component. */
export const dashboardPanel = (
  title: string,
  children: readonly BlockNode[],
  extra = ''
): BlockNode => ({
  type: 'container',
  element: 'section',
  props: {
    className:
      `flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-background-raised p-4 sm:p-5 ${extra}`.trim(),
  },
  children: [
    {
      type: 'text',
      element: 'h2',
      props: { className: 'text-md font-semibold text-foreground' },
      content: title,
    },
    ...children,
  ],
})

/** The recent-activity feed: who did what, newest first, the time in the mono face. */
export const activityList = (
  table: string,
  actorField: string,
  summaryField: string,
  timeField: string
): BlockNode => ({
  type: 'list',
  props: { 'aria-label': 'Activity' },
  dataSource: { table, sort: [{ field: timeField, direction: 'desc' }], limit: 6 },
  listDisplay: {
    itemTemplate: {
      title: `$record.${actorField}`,
      subtitle: `$record.${summaryField}`,
      metadata: [{ field: timeField, format: 'relative-date', className: 'font-mono' }],
    },
    emptyMessage: 'No activity yet. Changes people make show up here.',
  },
})

/** The page frame of a dashboard: the wide 12-column measure with its gutters. */
export const dashboardPage = (children: readonly BlockNode[]): BlockNode => ({
  type: 'container',
  element: 'section',
  props: { className: 'mx-auto flex w-full max-w-360 flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8' },
  children,
})

/** The note every dashboard block carries on the period. */
export const PERIOD_NOTE =
  'Declare the period on the page that places the block: `window: { default: 30d, presets: [{ id: 7d }, { id: 30d }, { id: 90d }] }`. The selector links to those three presets and every panel reads only the records whose date falls in the chosen one. The `window` is required: on a page without it the panels match no record.'
