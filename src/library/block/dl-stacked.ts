/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { appRegion } from '@/library/manifest/app-block-kit'
import { asComponent, PLACE_NOTE, THEME_NOTE } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** Short facts about one thing, laid out as a grid of term-over-value pairs. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'dl-stacked',
  title: 'Stacked description list',
  category: 'application',
  tags: ['description list', 'details', 'summary', 'record'],
  description:
    'Six short facts about one record, each term above its value, flowing as a responsive grid.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'The pairs are static text: edit `items` in the installed fragment, or write `$record.<field>` in a `detail` on a page bound to a record.',
  ],
  params: [],
  env: [],
  requires: [],
  build: ({ name }) =>
    asComponent(
      name,
      appRegion([
        {
          type: 'description-list',
          layout: 'stacked',
          props: { className: 'max-w-4xl' },
          items: [
            { term: 'Status', detail: 'Paid' },
            { term: 'Amount', detail: '1 240,00 €' },
            { term: 'Issued', detail: '12 Sep 2026' },
            { term: 'Client', detail: 'Atelier Nord' },
            { term: 'Owner', detail: 'Yanis Benali' },
            { term: 'Method', detail: 'Bank transfer' },
          ],
        },
      ])
    ),
})
