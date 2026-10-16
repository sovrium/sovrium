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
import { labelOf } from '@/library/manifest/field-labels'
import { composedToolbar } from './data-table-toolbar'

type P = (key: string) => string

/** The channel the toolbar publishes on and the grid listens to. */
const channelOf = (p: P): string => `${p('table')}-filter`

/**
 * The toolbar above the grid — the `data-table-toolbar` block's row: a search
 * box, a facet on the status field, a filter bar, then Export CSV and Import
 * CSV. Its controls sit OUTSIDE the table and publish on the grid's channel.
 */
const toolbarOf = (p: P): Readonly<Record<string, unknown>> =>
  composedToolbar({
    table: p('table'),
    channel: channelOf(p),
    facetField: p('statusField'),
    facetLabel: labelOf(p, 'statusLabel', 'statusField'),
  })

/**
 * The grid: labelled columns that sort from their header and read by field
 * type, row selection with a bulk delete, and a pager whose page size the
 * reader can change. It listens on the toolbar's channel.
 */
const dataTable = (p: P): Readonly<Record<string, unknown>> => {
  const table = p('table')
  return {
    type: 'table',
    dataSource: {
      table,
      bindTo: channelOf(p),
      sharedFilter: {},
      sort: [{ field: p('dateField'), direction: 'desc' }],
    },
    columns: [
      { field: p('referenceField'), label: labelOf(p, 'referenceLabel', 'referenceField') },
      { field: p('clientField'), label: labelOf(p, 'clientLabel', 'clientField') },
      { field: p('statusField'), label: labelOf(p, 'statusLabel', 'statusField') },
      { field: p('amountField'), label: labelOf(p, 'amountLabel', 'amountField') },
      { field: p('dateField'), label: labelOf(p, 'dateLabel', 'dateField') },
    ],
    selection: { mode: 'multiple' },
    bulkActions: [
      {
        label: 'Delete',
        icon: 'trash-2',
        action: { type: 'crud', operation: 'delete', table },
        confirm: {
          message: 'Delete {count} records? This cannot be undone.',
          confirmLabel: 'Delete',
        },
      },
    ],
    pagination: { pageSize: 10, pageSizeOptions: [10, 25, 50] },
    emptyMessage: p('emptyMessage'),
    noMatchMessage: p('noMatchMessage'),
  }
}

/** A data grid over one of your tables, on the shadcn/ui data table anatomy. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'data-table',
  title: 'Data table',
  category: 'console',
  shadcnBlock: null,
  tags: ['table', 'grid', 'records', 'search', 'filter', 'selection', 'pagination'],
  description:
    'A data grid over one of your tables under its toolbar — a search box, a status facet, a filter bar, Export CSV and Import CSV — with labelled columns that sort from their header, checkboxes with a bulk delete, and a pager with a page-size choice.',
  notes: [
    'No shadcn counterpart: shadcn/ui documents its data table as a guide rather than a block, so this block composes the same parts — toolbar, column headers, selection, pagination — as a toolbar row above one `table`.',
    'The toolbar is the `data-table-toolbar` block’s row, on the channel `<table>-filter`: its controls publish there and the grid listens. Install `data-table-toolbar` alone to put the same row above a board or a calendar too.',
    PLACE_NOTE,
    DATA_NOTE,
    'Each column is headed by its field name in words — `due_date` reads "Due date" — until you set its label parameter: `--set amountLabel=Budget`.',
    'Each column reads by its field type: the amount in its currency and aligned right, the status as its chip, the date in the page language. Add `format` or `align` to a column to override.',
    'What a reader types in the search box or adds as a filter narrows the rows for that visit only. The bulk delete names how many rows it removes and asks first; the grid respects your table permissions.',
    'On a narrow screen the grid scrolls sideways inside its frame rather than squeezing its columns.',
    THEME_NOTE,
  ],
  params: [
    stringParam('headline', 'The heading above the grid. Empty to omit.', '[Invoices]'),
    stringParam('table', 'The table the rows are read from.', 'invoices'),
    stringParam('referenceField', 'The text field drawn first — a number or a name.', 'reference'),
    stringParam('clientField', 'A second text field.', 'client'),
    stringParam('statusField', 'A status or single-select field, drawn as a chip.', 'status'),
    stringParam('amountField', 'A number or currency field, aligned right.', 'amount'),
    stringParam('dateField', 'A date field; the grid opens newest first.', 'issued_on'),
    stringParam(
      'referenceLabel',
      "The first column's header. Empty reads as the field name in words.",
      ''
    ),
    stringParam(
      'clientLabel',
      'The second column\'s header. Empty reads as the field name in words: `client` reads "Client".',
      ''
    ),
    stringParam(
      'statusLabel',
      "The status column's header. Empty reads as the field name in words.",
      ''
    ),
    stringParam(
      'amountLabel',
      "The amount column's header. Empty reads as the field name in words.",
      ''
    ),
    stringParam(
      'dateLabel',
      'The date column\'s header. Empty reads as the field name in words: `issued_on` reads "Issued on".',
      ''
    ),
    stringParam(
      'emptyMessage',
      'What the grid says when the table has no record.',
      'No record yet. Create one to see it here.'
    ),
    stringParam(
      'noMatchMessage',
      'What the grid says when the search or the filters leave nothing.',
      'Nothing matches. Clear the search or remove a filter to widen it.'
    ),
  ],
  tables: [
    {
      param: 'table',
      fields: [
        { name: 'reference', param: 'referenceField', type: 'single-line-text' },
        { name: 'client', param: 'clientField', type: 'single-line-text' },
        { name: 'status', param: 'statusField', type: 'status' },
        { name: 'amount', param: 'amountField', type: 'decimal' },
        { name: 'issued_on', param: 'dateField', type: 'date' },
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
          [...(p('headline') === '' ? [] : [panelHead(p('headline'))]), toolbarOf(p), dataTable(p)],
          'gap-4'
        ),
      ])
    )
  },
})
