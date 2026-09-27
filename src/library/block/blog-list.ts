/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  asComponent,
  DATA_NOTE,
  h2,
  param,
  PLACE_NOTE,
  section,
  stack,
  stringParam,
  THEME_NOTE,
  wrap,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** Your posts as a reading list: title, excerpt and date, newest first. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'blog-list',
  title: 'Posts as a list',
  category: 'marketing',
  tags: ['blog', 'posts', 'articles', 'list', 'writing'],
  description:
    'A narrow section listing the posts of your posts table — title, excerpt and publication date — newest first, with a Load more button past the first page.',
  notes: [
    PLACE_NOTE,
    DATA_NOTE,
    'The section says so plainly when the table holds no post yet.',
    THEME_NOTE,
  ],
  params: [
    stringParam('headline', 'The heading of the section.', '[Writing]'),
    stringParam('table', 'The table the posts are read from.', 'posts'),
    stringParam('titleField', 'The text field holding each title.', 'title'),
    stringParam('excerptField', 'The text field holding each excerpt.', 'excerpt'),
    stringParam('dateField', 'The date field the posts are sorted by.', 'published_at'),
    stringParam(
      'emptyMessage',
      'What the section says when there is no post.',
      'No post published yet.'
    ),
  ],
  tables: [
    {
      param: 'table',
      fields: [
        { name: 'title', param: 'titleField', type: 'single-line-text' },
        { name: 'excerpt', param: 'excerptField', type: 'long-text' },
        { name: 'published_at', param: 'dateField', type: 'date' },
      ],
    },
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(
      name,
      section([
        wrap(
          [
            stack(
              [
                h2(p('headline')),
                {
                  type: 'list',
                  dataSource: {
                    table: p('table'),
                    sort: [{ field: p('dateField'), direction: 'desc' }],
                    limit: 10,
                  },
                  listDisplay: {
                    itemTemplate: {
                      title: `$record.${p('titleField')}`,
                      subtitle: `$record.${p('excerptField')}`,
                      metadata: [{ field: p('dateField'), format: 'short-date' }],
                    },
                    emptyMessage: p('emptyMessage'),
                    loadMore: 'button',
                  },
                },
              ],
              'gap-8'
            ),
          ],
          'max-w-3xl'
        ),
      ])
    )
  },
})
