/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// sovrium-library: block/dashboard-01@0.37.0#2ccf14395ad7
// sovrium-library: block/dashboard-01@0.37.0#fef7f89f33df
// sovrium-library: block/dashboard-01@0.37.0#884b86d77032

// One marker per copy below, in order: the content column, the section-cards
// grid, the section card.
//
// Parts of the library's `dashboard-01` block (shadcn's dashboard-01), INSTALLED
// as literal copies for the console's data pages. The console's frame is its own
// shell (`./console-shell.ts`), so it takes the block's CONTENT column and its
// section cards, not the block's sidebar. Each copy is held to its subtree of
// the block by `Console Block Parity` (rows with `at`); re-install with
// `sovrium library add block/dashboard-01 --update`, never hand-edit the shapes.
//
// The bindings — the content column's children, the grid's cards, each card's
// metric (label, system read, its format, and `thresholds` painting a count of
// things to fix red from 1), its footer and its testid — are filled by the page
// that uses them, through `sectionCard` below: Welcome (`../pages/home.ts`) and
// the KPI strips of the data pages (users, runs, files, submissions, footprint,
// links), which keep their own grid and take the card.

import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

/** dashboard-01's content column: an `@container/main` column, 24px between sections on md+. */
export const dashboardContentCopy = {
  type: 'flex',
  props: {
    className: '@container/main flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6',
  },
  children: [],
} as const

/** dashboard-01's `section-cards` grid: one column, two from `@xl`, four from `@5xl`. */
export const sectionCardsCopy = {
  type: 'grid',
  props: {
    className: 'grid grid-cols-1 gap-4 px-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 lg:px-6',
  },
  children: [],
} as const

/** One of dashboard-01's section cards: the metric as the card's title, a footer line. */
export const sectionCardCopy = {
  type: 'card',
  footer: [
    {
      type: 'text',
      element: 'p',
      props: {
        className: 'text-sm text-muted-foreground',
      },
      content: '',
    },
  ],
  children: [
    {
      type: 'kpi',
      label: 'Pages',
      dataSource: {
        system: {
          endpoint: '/api/admin/config/reflection',
          valuePath: 'pageCount',
        },
      },
      kpiFormat: {
        type: 'number',
      },
      props: {
        className: 'border-0 bg-transparent p-0 shadow-none [--card-spacing:0px]!',
      },
    },
  ],
  props: {
    'data-testid': 'welcome-tile',
  },
} as const

/** The content column, holding a page's sections. */
export const dashboardContent = (children: readonly PageComponent[]): PageComponent =>
  ({ ...dashboardContentCopy, children }) as PageComponent

/** A section-cards grid, holding its cards. */
export const sectionCards = (
  cards: readonly PageComponent[],
  props: Readonly<Record<string, string>> = {}
): PageComponent =>
  ({
    ...sectionCardsCopy,
    props: { ...sectionCardsCopy.props, ...props },
    children: cards,
  }) as PageComponent

/** What a section card shows. */
export interface SectionCardBinding {
  readonly testId?: string
  readonly label: string
  readonly endpoint: string
  /** The figure's path in the read; leave it out when `system` carries a `valueTemplate`. */
  readonly valuePath?: string
  /** The rest of the system read — a query, a value template — beside the endpoint. */
  readonly system?: Readonly<Record<string, unknown>>
  /** How the figure is formatted: a plain number when omitted, unformatted when `null`. */
  readonly kpiFormat?: Readonly<Record<string, unknown>> | null
  /** The footer line; omitted, the card has none. */
  readonly footer?: readonly PageComponent[]
  /** Paint the figure red from 1: a count of things that need fixing. */
  readonly attention?: boolean
}

/** The copy's metric without its number format, for a figure that is not a number. */
const metricWithoutFormat = (
  metric: (typeof sectionCardCopy.children)[number]
): Omit<(typeof sectionCardCopy.children)[number], 'kpiFormat'> => {
  const { kpiFormat: _format, ...rest } = metric
  return rest
}

/** A section card bound to one figure of a system read. */
export const sectionCard = (binding: SectionCardBinding): PageComponent => {
  const [metric] = sectionCardCopy.children
  return {
    ...sectionCardCopy,
    props: binding.testId === undefined ? {} : { 'data-testid': binding.testId },
    footer: binding.footer ?? [],
    children: [
      {
        ...(binding.kpiFormat === null ? metricWithoutFormat(metric) : metric),
        label: binding.label,
        dataSource: {
          system: {
            endpoint: binding.endpoint,
            ...(binding.valuePath === undefined ? {} : { valuePath: binding.valuePath }),
            ...binding.system,
          },
        },
        ...(binding.kpiFormat === undefined || binding.kpiFormat === null
          ? {}
          : { kpiFormat: binding.kpiFormat }),
        ...(binding.attention === true ? { thresholds: [{ value: 1, color: 'red' }] } : {}),
      },
    ],
  } as PageComponent
}
