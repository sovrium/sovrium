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

/** People from one of your tables as rows: photo, name, role and a status word. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'list-avatars',
  title: 'Stacked list with avatars and status',
  category: 'application',
  tags: ['list', 'people', 'members', 'avatar', 'status'],
  description:
    'A card listing the records of one of your tables as rows — a photo, a name, a role and a status word — with a Load more button past the first page.',
  notes: [
    PLACE_NOTE,
    DATA_NOTE,
    'A record whose photo field is empty is drawn without a picture rather than with a broken image.',
    THEME_NOTE,
  ],
  params: [
    stringParam('headline', 'The heading above the list. Empty to omit.', '[Team]'),
    stringParam('table', 'The table the rows are read from.', 'members'),
    stringParam('nameField', 'The text field drawn as the row title.', 'name'),
    stringParam('roleField', 'The text field drawn under the name.', 'role'),
    stringParam('statusField', 'The text field drawn as the status word.', 'status'),
    stringParam('photoField', 'The URL field holding each photo.', 'photo'),
    stringParam(
      'emptyMessage',
      'What the list says when the table has no record.',
      'No one here yet. Add a record to see it listed.'
    ),
  ],
  tables: [
    {
      param: 'table',
      fields: [
        { name: 'name', param: 'nameField', type: 'single-line-text' },
        { name: 'role', param: 'roleField', type: 'single-line-text' },
        { name: 'status', param: 'statusField', type: 'single-line-text' },
        { name: 'photo', param: 'photoField', type: 'url' },
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
                    sort: [{ field: p('nameField'), direction: 'asc' }],
                    limit: 20,
                  },
                  listDisplay: {
                    itemTemplate: {
                      title: `$record.${p('nameField')}`,
                      subtitle: `$record.${p('roleField')}`,
                      image: `$record.${p('photoField')}`,
                      badge: `$record.${p('statusField')}`,
                    },
                    emptyMessage: p('emptyMessage'),
                    loadMore: 'button',
                  },
                },
              ],
              'max-w-3xl flex-col'
            ),
          ],
          'gap-4'
        ),
      ])
    )
  },
})
