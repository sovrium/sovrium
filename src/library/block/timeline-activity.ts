/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  asComponent,
  flex,
  DATA_NOTE,
  panel,
  panelHead,
  param,
  PLACE_NOTE,
  stack,
  stringParam,
  THEME_NOTE,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** What happened, newest first: an event, who did it and how long ago. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'timeline-activity',
  title: 'Activity feed',
  category: 'application',
  tags: ['activity', 'feed', 'timeline', 'history', 'events'],
  description:
    'A card listing the records of your events table newest first — what happened, who did it, and how long ago — with a Load more button past the first page.',
  notes: [
    PLACE_NOTE,
    DATA_NOTE,
    'It is a `list` over the events, not the `timeline` type: `timeline` draws dated bars on a time axis, which suits a schedule rather than a feed.',
    THEME_NOTE,
  ],
  params: [
    stringParam('headline', 'The heading above the feed. Empty to omit.', '[Activity]'),
    stringParam('table', 'The table the events are read from.', 'events'),
    stringParam('titleField', 'The text field saying what happened.', 'title'),
    stringParam('actorField', 'The text field saying who or what did it.', 'actor'),
    stringParam('dateField', 'The date-and-time field the feed is sorted by.', 'occurred_at'),
    stringParam(
      'emptyMessage',
      'What the feed says when nothing has happened yet.',
      'Nothing has happened yet.'
    ),
  ],
  tables: [
    {
      param: 'table',
      fields: [
        { name: 'title', param: 'titleField', type: 'single-line-text' },
        { name: 'actor', param: 'actorField', type: 'single-line-text' },
        { name: 'occurred_at', param: 'dateField', type: 'datetime' },
      ],
    },
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
            flex(
              [
                {
                  type: 'list',
                  dataSource: {
                    table: p('table'),
                    sort: [{ field: p('dateField'), direction: 'desc' }],
                    limit: 20,
                  },
                  listDisplay: {
                    itemTemplate: {
                      title: `$record.${p('titleField')}`,
                      subtitle: `$record.${p('actorField')}`,
                      metadata: [{ field: p('dateField'), format: 'relative-time' }],
                    },
                    emptyMessage: p('emptyMessage'),
                    loadMore: 'button',
                  },
                },
              ],
              'max-w-2xl flex-col'
            ),
          ],
          'gap-4'
        ),
      ])
    )
  },
})
