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

/** The grid itself: columns, selection, the bulk delete and the per-row delete. */
const actionsTable = (p: (key: string) => string): Readonly<Record<string, unknown>> => {
  const table = p('table')
  return {
    type: 'table',
    dataSource: { table, sort: [{ field: p('dateField'), direction: 'desc' }] },
    columns: [
      { field: p('referenceField'), label: '[Reference]' },
      { field: p('clientField'), label: '[Client]' },
      { field: p('amountField'), label: '[Amount]', align: 'right' },
      { field: p('dateField'), label: '[Date]', format: 'short-date' },
      {
        type: 'actions',
        label: '',
        actions: [
          {
            label: 'Delete',
            icon: 'trash-2',
            action: {
              type: 'crud',
              operation: 'delete',
              table,
              confirm: true,
              confirmMessage: 'Delete this record? This cannot be undone.',
            },
          },
        ],
      },
    ],
    selection: { mode: 'multiple' },
    bulkActions: [
      {
        label: 'Delete',
        icon: 'trash-2',
        action: { type: 'crud', operation: 'delete', table },
        confirm: 'Delete {count} records? This cannot be undone.',
      },
    ],
    toolbar: { search: true, columnToggle: true, export: true },
    pagination: { pageSize: 25 },
    emptyMessage: p('emptyMessage'),
  }
}

/** A data grid over one of your tables, with row selection, a bulk action and a per-row action. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'table-with-actions',
  title: 'Table with selection and bulk actions',
  category: 'application',
  tags: ['table', 'grid', 'records', 'bulk actions', 'selection'],
  description:
    'A data grid over one of your tables: sortable columns, a search box, checkboxes to select rows, a bulk delete that names how many rows it removes, and a delete action on each row.',
  notes: [
    PLACE_NOTE,
    DATA_NOTE,
    'Both deletes ask for confirmation first and name what they remove. The grid respects your table permissions: a viewer who may not delete sees the actions refused.',
    'On a narrow screen the grid scrolls sideways inside its frame rather than squeezing its columns.',
    THEME_NOTE,
  ],
  params: [
    stringParam('headline', 'The heading above the grid. Empty to omit.', '[Invoices]'),
    stringParam('table', 'The table the rows are read from.', 'invoices'),
    stringParam('referenceField', 'The text field drawn first — a number or a name.', 'reference'),
    stringParam('clientField', 'A second text field.', 'client'),
    stringParam('amountField', 'A number field, aligned right.', 'amount'),
    stringParam('dateField', 'A date field.', 'issued_on'),
    stringParam(
      'emptyMessage',
      'What the grid says when the table has no record.',
      'No record yet. Create one to see it here.'
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
    return asComponent(
      name,
      panel([
        stack(
          [...(p('headline') === '' ? [] : [panelHead(p('headline'))]), actionsTable(p)],
          'gap-4'
        ),
      ])
    )
  },
})
