/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// sovrium-library: block/dashboard-01@0.37.0#884b86d77032

// One KPI card of a section-cards strip: its label, source and number format are passed per site.

// ── From components/dashboard-blocks.ts ────────────────────────────────────────
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
// ── From sectionCardCopy ───────────────────────────────────────────────────────
/** One of dashboard-01's section cards: the metric as the card's title, a footer line. */

import type { AppEncoded as AppConfig } from '@/domain/models/app'

type Template = NonNullable<AppConfig['components']>[number]

// eslint-disable-next-line sovrium/no-double-assertion -- a template that declares inputs writes `$name` where the component type expects a list or an object; each placement is decoded as the page component it produces when the app starts
export const consoleSectionCard = {
  name: 'console-section-card',
  type: 'card',
  render: 'transparent',
  inputs: {
    label: {
      kind: 'text',
      required: true,
    },
    dataSource: {
      kind: 'json',
      required: true,
    },
    kpiFormat: {
      kind: 'json',
    },
    footer: {
      kind: 'json',
    },
  },
  footer: '$footer',
  children: [
    {
      type: 'kpi',
      label: '$label',
      dataSource: '$dataSource',
      kpiFormat: '$kpiFormat',
      props: {
        className: 'border-0 bg-transparent p-0 shadow-none [--card-spacing:0px]!',
      },
    },
  ],
  props: {
    className: '*:data-[slot=card-footer]:flex-1 *:data-[slot=card-footer]:items-start',
  },
} as unknown as Template
