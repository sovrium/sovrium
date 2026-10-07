/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { asComponent, param, stringParam, THEME_NOTE } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'
import { RECORD_PAGE_NOTE, recordPanel } from '@/library/manifest/record-block-kit'

/** The discussion of the page's record: the composer first, newest comment on top. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'record-comments',
  title: 'Record comments',
  category: 'application',
  tags: ['record', 'comments', 'discussion', 'thread'],
  description:
    'The comments on the page’s record: a composer at the top and the thread under it, newest first, each with its author, avatar and a relative time.',
  notes: [
    RECORD_PAGE_NOTE,
    'Comments follow the table’s `comment` permission: a reader without it sees the thread but no composer, and a visitor who is not signed in sees neither.',
    THEME_NOTE,
  ],
  params: [
    stringParam('table', 'The table the page’s record belongs to.', 'projects'),
    stringParam('headline', 'The heading above the thread.', 'Comments'),
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(
      name,
      recordPanel(p('headline'), [
        {
          type: 'comments',
          sort: 'newest',
          limit: 20,
          paginationStyle: 'loadMore',
          emptyText: 'No comment yet. Start the conversation.',
          props: { placeholder: 'Write a comment…' },
        },
      ])
    )
  },
})
