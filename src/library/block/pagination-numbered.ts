/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { appRegion, span } from '@/library/manifest/app-block-kit'
import { asComponent, flex, PLACE_NOTE, THEME_NOTE } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** Numbered pages for a long list, with the range shown beside them. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'pagination-numbered',
  title: 'Numbered pagination',
  category: 'application',
  tags: ['pagination', 'pages', 'navigation', 'list'],
  description:
    'Numbered page links with previous and next, the current page marked, beside a line saying which records are shown.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'Set `totalPages` and `currentPage` in the installed fragment. A table or list bound to a table paginates itself; use this block beside content you page by hand.',
  ],
  params: [],
  env: [],
  requires: [],
  build: ({ name }) =>
    asComponent(
      name,
      appRegion([
        flex(
          [
            span('Showing 21–40 of 142', 'text-sm text-foreground-subtle'),
            { type: 'pagination', totalPages: 8, currentPage: 2, siblingCount: 1 },
          ],
          'flex-wrap items-center justify-between gap-4'
        ),
      ])
    ),
})
