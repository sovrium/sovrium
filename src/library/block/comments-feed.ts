/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  asComponent,
  panel,
  panelHead,
  param,
  stack,
  stringParam,
  THEME_NOTE,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** The comment thread of the record a page shows, with its composer. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'comments-feed',
  title: 'Comment thread',
  category: 'application',
  tags: ['comments', 'discussion', 'thread', 'feed', 'record'],
  description:
    'The comment thread of one record — author, avatar, text and time — with a box to add a comment, newest first.',
  notes: [
    'Place it on a record page — a page generated per record with `collection` — and it attaches itself to that page’s record and table. On any other page it has no record to read.',
    'The thread follows the table’s `comment` permission: a reader without it does not see the thread, and a visitor who is not signed in sees a prompt to sign in instead of the composer.',
    THEME_NOTE,
  ],
  params: [
    stringParam('headline', 'The heading above the thread. Empty to omit.', '[Comments]'),
    stringParam('placeholder', 'The hint inside the comment box.', 'Add a comment'),
    stringParam(
      'emptyText',
      'What the thread says before the first comment.',
      'No comment yet. Start the thread.'
    ),
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(
      name,
      panel([
        stack(
          [
            ...(p('headline') === '' ? [] : [panelHead(p('headline'))]),
            {
              type: 'comments',
              sort: 'newest',
              limit: 20,
              paginationStyle: 'loadMore',
              emptyText: p('emptyText'),
              props: { placeholder: p('placeholder') },
            },
          ],
          'max-w-2xl gap-4'
        ),
      ])
    )
  },
})
