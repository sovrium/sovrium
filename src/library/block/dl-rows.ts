/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { appHeading, appRegion, para } from '@/library/manifest/app-block-kit'
import {
  asComponent,
  param,
  PLACE_NOTE,
  stringParam,
  THEME_NOTE,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** The facts about one thing, each named, read top to bottom in a card. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'dl-rows',
  title: 'Description list in a card',
  category: 'application',
  tags: ['description list', 'details', 'record', 'fields'],
  description:
    'A card that names a record and lists its facts as rows, the term on the left and the value on the right, with a rule under each row.',
  notes: [
    'Place it on a page that shows one record — a path ending in `/:id` and `dataSource: { table: <your table>, mode: single, param: id }` on the page. Each detail is that record’s field drawn by its type, and an empty one reads "Not set".',
    PLACE_NOTE,
    THEME_NOTE,
    'The rows are static text: edit `items` in the installed fragment. On a page bound to a record, write `$record.<field>` in a `detail` to show that record’s value.',
  ],
  params: [
    stringParam('table', 'The table the page’s record belongs to.', 'clients'),
    stringParam('field1', 'The first fact.', 'legal_name'),
    stringParam('field2', 'The second fact.', 'contact_email'),
    stringParam('field3', 'The third fact.', 'billing_address'),
    stringParam('field4', 'The fourth fact.', 'payment_terms'),
    stringParam('field5', 'The fifth fact.', 'vat_number'),
    stringParam('title', 'The card heading.', 'Client details'),
    stringParam(
      'subtitle',
      'One line under the heading.',
      'Shown to members of Finance and Operations.'
    ),
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
          type: 'card',
          props: { className: 'max-w-3xl p-0' },
          children: [
            {
              type: 'container',
              props: { className: 'border-b border-border p-6' },
              children: [
                appHeading(p('title')),
                para(p('subtitle'), 'mt-1 text-sm text-foreground-subtle'),
              ],
            },
            {
              type: 'description-list',
              layout: 'rows',
              props: { className: 'px-6' },
              items: [
                { term: '[Legal name]', field: p('field1') },
                { term: '[Contact]', field: p('field2') },
                { term: '[Billing address]', field: p('field3') },
                { term: '[Payment terms]', field: p('field4') },
                { term: '[VAT number]', field: p('field5') },
              ],
            },
          ],
        },
      ])
    )
  },
})
