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

/** A filter bar driving a paged data grid over one of your tables. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'table-with-filters',
  title: 'Table with a filter bar',
  category: 'application',
  tags: ['table', 'filter', 'grid', 'records', 'search'],
  description:
    'A filter bar above a paged data grid over one of your tables. Each condition the reader adds appears as a removable chip, and the grid re-reads as they change.',
  notes: [
    PLACE_NOTE,
    DATA_NOTE,
    'The bar and the grid talk over a channel named after the installed block, so two copies on one page stay independent.',
    THEME_NOTE,
  ],
  params: [
    stringParam('headline', 'The heading above the grid. Empty to omit.', '[Invoices]'),
    stringParam('table', 'The table the rows are read from.', 'invoices'),
    stringParam('referenceField', 'The text field drawn first — a number or a name.', 'reference'),
    stringParam('clientField', 'A second text field, offered as a filter.', 'client'),
    stringParam('amountField', 'A number field, offered as a filter.', 'amount'),
    stringParam('dateField', 'A date field, offered as a filter.', 'issued_on'),
    stringParam(
      'emptyMessage',
      'What the grid says when the table has no record.',
      'No record yet. Create one to see it here.'
    ),
    stringParam(
      'noMatchMessage',
      'What the grid says when the filters leave nothing.',
      'Nothing matches these filters. Remove one to widen the search.'
    ),
  ],
  tables: [
    {
      param: 'table',
      fields: [
        { name: 'reference', param: 'referenceField', type: 'single-line-text' },
        { name: 'client', param: 'clientField', type: 'single-line-text' },
        { name: 'amount', param: 'amountField', type: 'decimal' },
        { name: 'issued_on', param: 'dateField', type: 'date' },
      ],
    },
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    const channel = `${name}-filter`
    return asComponent(
      name,
      panel([
        stack(
          [
            ...(p('headline') === '' ? [] : [panelHead(p('headline'))]),
            {
              type: 'filter-bar',
              publishes: { bindTo: channel },
              fields: [
                { name: p('clientField'), label: '[Client]', kind: 'text' },
                { name: p('amountField'), label: '[Amount]', kind: 'number' },
                { name: p('dateField'), label: '[Date]', kind: 'date' },
              ],
            },
            {
              type: 'table',
              dataSource: {
                table: p('table'),
                bindTo: channel,
                sharedFilter: {},
                sort: [{ field: p('dateField'), direction: 'desc' }],
              },
              columns: [
                { field: p('referenceField'), label: '[Reference]' },
                { field: p('clientField'), label: '[Client]' },
                { field: p('amountField'), label: '[Amount]', align: 'right' },
                { field: p('dateField'), label: '[Date]', format: 'short-date' },
              ],
              pagination: { pageSize: 10 },
              emptyMessage: p('emptyMessage'),
              noMatchMessage: p('noMatchMessage'),
            },
          ],
          'gap-3'
        ),
      ])
    )
  },
})
