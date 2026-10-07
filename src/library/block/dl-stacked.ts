/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { appRegion } from '@/library/manifest/app-block-kit'
import {
  asComponent,
  param,
  PLACE_NOTE,
  stringParam,
  THEME_NOTE,
} from '@/library/manifest/block-kit'
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
    'Place it on a page that shows one record — a path ending in `/:id` and `dataSource: { table: <your table>, mode: single, param: id }` on the page. Each detail is that record’s field drawn by its type, and an empty one reads "Not set".',
    PLACE_NOTE,
    THEME_NOTE,
    'The pairs are static text: edit `items` in the installed fragment, or write `$record.<field>` in a `detail` on a page bound to a record.',
  ],
  params: [
    stringParam('table', 'The table the page’s record belongs to.', 'clients'),
    stringParam('field1', 'The first fact.', 'legal_name'),
    stringParam('field2', 'The second fact.', 'contact_email'),
    stringParam('field3', 'The third fact.', 'billing_address'),
    stringParam('field4', 'The fourth fact.', 'payment_terms'),
    stringParam('field5', 'The fifth fact.', 'vat_number'),
  ],
  tables: [
    {
      param: 'table',
      fields: [
        { name: 'legal_name', param: 'field1', type: 'single-line-text' },
        { name: 'contact_email', param: 'field2', type: 'email' },
        { name: 'billing_address', param: 'field3', type: 'long-text' },
        { name: 'payment_terms', param: 'field4', type: 'single-line-text' },
        { name: 'vat_number', param: 'field5', type: 'single-line-text' },
      ],
    },
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(
      name,
      appRegion([
        {
          type: 'description-list',
          layout: 'stacked',
          props: { className: 'max-w-4xl' },
          items: [
            { term: '[Legal name]', field: p('field1') },
            { term: '[Contact]', field: p('field2') },
            { term: '[Billing address]', field: p('field3') },
            { term: '[Payment terms]', field: p('field4') },
            { term: '[VAT number]', field: p('field5') },
          ],
        },
      ])
    )
  },
})
