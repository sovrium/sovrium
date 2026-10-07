/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What the RECORD-PAGE blocks share. The page binds the record ONCE —
 * `dataSource: { table, mode: single, param: id }` on a page whose path ends
 * in `/:id` — and every block on it reads that record through `$record`;
 * related lists filter on its id.
 *
 * The page lays the blocks out 8 / 4 at `lg` (the header and the main column
 * on the left, the facts sidebar on the right), the sidebar above the main
 * column on a tablet, and one column on a phone. The blocks carry no page
 * frame of their own so they compose in any of those arrangements.
 */

import type { BlockNode } from './block-kit'

/** A record-page region: a bordered surface with an optional heading. */
export const recordPanel = (title: string, children: readonly BlockNode[]): BlockNode => ({
  type: 'container',
  element: 'section',
  props: {
    className:
      'flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-background-raised p-4 sm:p-5',
    ...(title === '' ? {} : { 'aria-label': title }),
  },
  children: [
    ...(title === ''
      ? []
      : [
          {
            type: 'text',
            element: 'h2',
            props: { className: 'text-md font-semibold text-foreground' },
            content: title,
          },
        ]),
    ...children,
  ],
})

/** One fact of the record drawn by its field type, under a small label. */
export const recordFact = (label: string, field: string): BlockNode => ({
  type: 'flex',
  props: { className: 'flex min-w-0 flex-col gap-0.5' },
  children: [
    {
      type: 'text',
      element: 'span',
      props: { className: 'text-sm text-foreground-muted' },
      content: label,
    },
    { type: 'record-field', props: { field, className: 'text-md text-foreground' } },
  ],
})

/** The note every record-page block carries on the page binding it needs. */
export const RECORD_PAGE_NOTE =
  'Place it on a page that shows one record: a path ending in `/:id` and `dataSource: { table: <your table>, mode: single, param: id }` on the page. The block reads that record; a record the reader may not see, or one that does not exist, gives the page’s not-found answer for both.'
