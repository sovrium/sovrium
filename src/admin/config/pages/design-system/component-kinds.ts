/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The Components gallery, grouped by what each template IS.
//
// A template declares no kind of its own — a key for one would be a second
// place to say what its root type already says — so the usage read derives it
// (`items[].kind`) and counts each kind on its envelope (`cardCount`, …). The
// gallery draws one titled group per kind, in a fixed order, and none for a
// kind the app has no template of: an empty heading is a promise of nothing.
//
// Each group binds the SAME rows and keeps only its own kind with a per-row
// gate on the row wrapper, which suppresses the wrapper itself rather than
// leaving an empty box behind. The group's own gate reads the page record —
// the usage envelope — since zero rows render zero rows and leave nothing for
// a row gate to test.

import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

/** The five kinds, in the order the gallery draws them. */
const KINDS = [
  { kind: 'page-section', label: '$t:admin.ds.kind.sections', count: 'pageSectionCount' },
  { kind: 'card', label: '$t:admin.ds.kind.cards', count: 'cardCount' },
  { kind: 'form', label: '$t:admin.common.forms', count: 'formCount' },
  { kind: 'navigation', label: '$t:admin.ds.kind.navigation', count: 'navigationCount' },
  { kind: 'data-view', label: '$t:admin.ds.kind.dataViews', count: 'dataViewCount' },
] as const

/** One group per kind the app has a template of: its heading, then its tiles. */
export const componentKindGroups = (
  rows: Readonly<Record<string, unknown>>,
  tile: readonly PageComponent[]
): readonly PageComponent[] =>
  KINDS.map(
    ({ kind, label, count }) =>
      ({
        type: 'container',
        element: 'section',
        visibility: { record: { field: count, gt: 0 } },
        props: { 'aria-label': label, className: 'flex flex-col gap-4' },
        children: [
          {
            type: 'text',
            element: 'h2',
            props: { className: 'text-foreground text-base font-semibold' },
            content: label,
          },
          {
            type: 'container',
            element: 'div',
            props: { className: 'flex flex-col gap-4' },
            dataSource: rows,
            children: [
              {
                type: 'container',
                element: 'div',
                props: { className: 'contents' },
                visibility: { record: { field: 'kind', eq: kind } },
                children: [...tile],
              },
            ],
          },
        ],
      }) as PageComponent
  )
