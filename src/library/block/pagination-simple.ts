/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { appRegion, span } from '@/library/manifest/app-block-kit'
import { asComponent, flex, linkButton, PLACE_NOTE, THEME_NOTE } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

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
                linkButton('Previous', '?page=1', 'secondary'),
                span('Page 2 of 8', 'text-sm text-foreground-subtle'),
                linkButton('Next', '?page=3', 'secondary'),
              ],
              'items-center justify-between gap-4'
            ),
          ],
        },
      ])
    ),
})
