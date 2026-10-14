/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { appRegion, span } from '@/library/manifest/app-block-kit'
import { asComponent, flex, PLACE_NOTE, THEME_NOTE } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/**
 * shadcn's `PaginationPrevious` / `PaginationNext`: a ghost button with a
 * chevron, its word folding away on a phone while the link keeps its name.
 */
const stepLink = (label: string, href: string, direction: 'previous' | 'next') => ({
  type: 'link',
  props: {
    href,
    'aria-label': `Go to ${label.toLowerCase()} page`,
    className:
      direction === 'previous'
        ? 'inline-flex h-8 items-center gap-1 rounded-lg px-2.5 pl-1.5 text-sm font-medium text-foreground no-underline hover:bg-muted hover:no-underline [&_svg]:size-4'
        : 'inline-flex h-8 items-center gap-1 rounded-lg px-2.5 pr-1.5 text-sm font-medium text-foreground no-underline hover:bg-muted hover:no-underline [&_svg]:size-4',
  },
  children:
    direction === 'previous'
      ? [
          { type: 'icon', props: { name: 'chevron-left', size: 16 } },
          span(label, 'hidden sm:block'),
        ]
      : [
          span(label, 'hidden sm:block'),
          { type: 'icon', props: { name: 'chevron-right', size: 16 } },
        ],
})

/** Previous and next, with where the reader is between them. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'pagination-simple',
  title: 'Previous and next pagination',
  category: 'application',
  tags: ['pagination', 'previous', 'next', 'navigation'],
  description:
    'Two links, previous and next, with the current page and the page count between them — for lists read in order.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'The two links point at `?page=1` and `?page=3`: set them, and the page line, for the page the block sits on.',
  ],
  params: [],
  env: [],
  requires: [],
  build: ({ name }) =>
    asComponent(
      name,
      appRegion([
        {
          type: 'container',
          element: 'nav',
          props: { 'aria-label': 'Pagination' },
          children: [
            flex(
              [
                stepLink('Previous', '?page=1', 'previous'),
                span('Page 2 of 8', 'text-sm text-muted-foreground'),
                stepLink('Next', '?page=3', 'next'),
              ],
              'items-center justify-between gap-4'
            ),
          ],
        },
      ])
    ),
})
