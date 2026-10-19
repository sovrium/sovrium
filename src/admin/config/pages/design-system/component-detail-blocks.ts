/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// DESIGN SYSTEM · one component's page, two of its blocks: a viewport frame
// (the template re-rendered at a width, scaled to the column) and the props
// table. Split from `components.ts`, which composes the page.

import { ledgerTable } from '../../components/data-table-blocks'
import { DESIGN_USAGE_ENDPOINT } from '../../system-sources'
import { kitType, sectionHeading } from './sections'
import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

/**
 * A viewport's stable name, read off its translation key (`…viewport.mobile`
 * → `mobile`), so an id and a test hook never move with the language. The
 * chip's caption is the sibling key `…viewport.mobile375`, one string per
 * language rather than a label and a width glued together.
 */
export const viewportSlug = (labelKey: string): string =>
  labelKey.slice(labelKey.lastIndexOf('.') + 1)

/**
 * One viewport, drawn and headed — the detail page's grammar.
 *
 * The index used a `?viewport=` switcher and the detail page inherited it. A
 * switcher shows one width and hides two, and the question a reader opens a
 * template page with is what it does BETWEEN them: which crumb drops at 768,
 * which control leaves at 375. So all three are drawn, stacked, each headed
 * with the width it is.
 *
 * `overflow-x-auto`, so a frame SCROLLS rather than clipping. A clipped
 * specimen shows the top-left corner of a component and calls it the component.
 *
 * The frame is pinned LEFT rather than centred. Three widths centred inside one
 * column start at three different x positions, so the reader compares them by
 * eye against three different origins — which is the one thing a stack of
 * widths exists to make easy. Sharing an edge is what makes the difference
 * between them readable.
 *
 * ─── THE NUMBER IN THE HEADING IS NOW THE DOCUMENT'S OWN WIDTH ────────────
 *
 * `viewport` re-renders the subject in a document of its own at the stated
 * width, so the subject's `@media` rules answer THAT width. Before it, the
 * three frames were three boxes in one 1440px document: a header declaring
 * `lg:flex` drew its desktop cluster in all three and overflowed the 375 box
 * sideways, which reads as proof the operator's responsive design is broken.
 *
 * Desktop is 1280 EXPLICITLY, not the column it happens to get. The column is
 * ~854px, below Tailwind's `lg`, so a Desktop frame taking its width from the
 * layout would draw the mobile layout under a heading that says 1280 — the
 * same lie the frames were built to remove, one level in.
 *
 * The wrapper keeps the width too, clamped to the column: at 1280 it scrolls
 * to reach the rest of the document rather than shrinking it, because `-240`
 * is the promise that the number in the heading is the number in the frame.
 */
export const stackedFrame = (label: string, width: number): PageComponent =>
  ({
    type: 'container',
    element: 'section',
    props: {
      className: 'flex scroll-mt-6 flex-col gap-3',
      id: `viewport-${viewportSlug(label)}`,
      'data-design-section': `viewport-${viewportSlug(label)}`,
    },
    children: [
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex flex-wrap items-baseline gap-3' },
        children: [
          sectionHeading(label),
          {
            type: 'text',
            element: 'span',
            props: { className: 'text-muted-foreground font-mono text-[11px]' },
            content: String(width),
          },
          // The scale the frame below is drawn at, written by the framed document
          // once it has measured the column (`data-design-frame-scale`).
          {
            type: 'text',
            element: 'span',
            props: { className: 'text-muted-foreground text-[11px]' },
            content: '$t:admin.ds.viewport.shownAt',
          },
          {
            type: 'text',
            element: 'span',
            props: {
              className: 'text-muted-foreground font-mono text-[11px]',
              'data-design-frame-scale': viewportSlug(label),
            },
            content: '100 %',
          },
        ],
      },
      {
        type: 'container',
        element: 'div',
        // No padding: the framed document draws its own page, so the frame
        // meets the box's edge and the scale it is drawn at is the column's
        // whole width, not the width less a gutter on each side.
        props: { className: 'border-border bg-background overflow-hidden rounded-lg border' },
        children: [
          {
            type: 'container',
            element: 'div',
            props: {
              className: 'overflow-x-auto',
              'data-design-viewport-frame': viewportSlug(label),
              style: { width: `${width}px`, maxWidth: '100%' },
            },
            children: [
              {
                type: 'specimen',
                subject: { component: '$record.name' },
                viewport: { width },
                props: { ...kitType('specimen') },
              },
            ],
          },
        ],
      },
    ],
  }) as PageComponent

/**
 * The variables a template reads, as a ledger: each one, the type of node it
 * fills, and the sample the specimens above are drawn with — what the first
 * page embedding the template hands it (`propRows` on the usage read).
 * Narrowed by `$record.name` from the outer row, as the route chips are.
 */
export const propsTable = (): PageComponent =>
  ({
    type: 'container',
    element: 'section',
    props: { className: 'flex flex-col gap-3', 'data-design-component-props': '$record.name' },
    children: [
      sectionHeading('$t:admin.ds.components.props'),
      ledgerTable({
        props: { 'aria-label': '$t:admin.ds.components.props' },
        dataSource: {
          system: {
            endpoint: DESIGN_USAGE_ENDPOINT,
            rowsKey: 'propRows',
            query: { subject: 'component', name: '$record.name' },
          },
        },
        columns: [
          // Not sortable: the rows are in the order the template reads its
          // variables, which is the only order that means anything here.
          { field: 'prop', label: '$t:admin.ds.components.prop', sortable: false },
          { field: 'type', label: '$t:admin.common.type', sortable: false },
          { field: 'sample', label: '$t:admin.ds.components.sample', sortable: false },
        ],
        emptyMessage: '$t:admin.ds.components.noProps',
      }),
    ],
  }) as PageComponent
