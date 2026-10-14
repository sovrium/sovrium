/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  asComponent,
  param,
  PLACE_NOTE,
  stringParam,
  THEME_NOTE,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** The rows shadcn's table demo writes: four invoices, the amount last. */
const ROWS: ReadonlyArray<readonly string[]> = [
  ['INV001', 'Paid', 'Credit card', '$250.00'],
  ['INV002', 'Pending', 'PayPal', '$150.00'],
  ['INV003', 'Unpaid', 'Bank transfer', '$350.00'],
  ['INV004', 'Paid', 'Credit card', '$450.00'],
]

/** shadcn's Table with rows written in the config: a caption, a header row and the body. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'table-static',
  shadcnBlock: null,
  title: 'Static table',
  category: 'console',
  tags: ['table', 'static', 'rows', 'reference', 'caption'],
  description:
    "A table of rows written in your config, on shadcn's table anatomy: a caption naming it, a header row, and the body rows with the amount aligned right.",
  notes: [
    'No shadcn counterpart: shadcn/ui ships Table as a component, not a block. This block is its demo: a `table` with no `dataSource`, so it draws the rows you write and reads no data.',
    'Edit `tableHeaders` and `tableRows` in the installed fragment to hold your own rows; `tableColumns` aligns or styles one column. To list the records of a table instead, install `block/data-table`.',
    'The caption is the table’s accessible name: say what the rows are.',
    PLACE_NOTE,
    THEME_NOTE,
  ],
  params: [
    stringParam('caption', 'What the rows are. Empty to omit.', 'A list of your recent invoices.'),
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(name, {
      type: 'table',
      ...(p('caption') === '' ? {} : { caption: p('caption') }),
      tableHeaders: ['Invoice', 'Status', 'Method', 'Amount'],
      tableColumns: [{ className: 'font-medium' }, {}, {}, { align: 'right' }],
      tableRows: ROWS,
    })
  },
})
