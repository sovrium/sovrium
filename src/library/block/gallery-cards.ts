/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  asComponent,
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

/** The records of one of your tables as image cards in a responsive grid. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'gallery-cards',
  title: 'Grid of image cards',
  category: 'application',
  tags: ['gallery', 'cards', 'grid', 'images', 'records'],
  description:
    'The records of one of your tables as cards — a cover image, a title and one line under it — one column on a phone, three on a wide screen. A click opens the record’s page.',
  notes: [
    PLACE_NOTE,
    DATA_NOTE,
    'A record with no cover is drawn as a card without a picture. `recordHref` is the page a card opens; `$record.id` in it is replaced by the record’s id.',
    THEME_NOTE,
  ],
  params: [
    stringParam('headline', 'The heading above the cards. Empty to omit.', '[Projects]'),
    stringParam('table', 'The table the cards are read from.', 'projects'),
    stringParam('titleField', 'The text field drawn as the card title.', 'title'),
    stringParam('subtitleField', 'The text field drawn under the title.', 'client'),
    stringParam('coverField', 'The URL field holding each cover image.', 'cover'),
    stringParam('recordHref', 'The page a card opens.', '/projects/$record.id'),
    stringParam(
      'emptyMessage',
      'What the grid says when the table has no record.',
      'No project yet. Create one to see its card here.'
    ),
  ],
  tables: [
    {
      param: 'table',
      fields: [
        { name: 'title', param: 'titleField', type: 'single-line-text' },
        { name: 'client', param: 'subtitleField', type: 'single-line-text' },
        { name: 'cover', param: 'coverField', type: 'url' },
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
            {
              type: 'gallery',
              dataSource: { table: p('table') },
              layout: 'grid',
              gridColumns: { mobile: 1, sm: 2, lg: 3 },
              emptyMessage: p('emptyMessage'),
              galleryCard: {
                coverImage: `$record.${p('coverField')}`,
                aspectRatio: '16:10',
                children: [
                  {
                    type: 'text',
                    element: 'h3',
                    props: { className: 'text-md font-semibold text-foreground' },
                    content: `$record.${p('titleField')}`,
                  },
                  {
                    type: 'text',
                    element: 'p',
                    props: { className: 'text-sm text-foreground-subtle' },
                    content: `$record.${p('subtitleField')}`,
                  },
                ],
                onClick: { type: 'navigate', path: p('recordHref') },
              },
            },
          ],
          'gap-4'
        ),
      ])
    )
  },
})
