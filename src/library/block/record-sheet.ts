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

type Node = Readonly<Record<string, unknown>>
type P = (key: string) => string

/** The first three children of the opened record, when the block names a child table. */
const relatedRows = (p: P): readonly Node[] =>
  p('childTable') === ''
    ? []
    : [
        {
          label: labelOf(p, 'childLabel', 'childTable'),
          table: p('childTable'),
          field: p('parentField'),
          limit: 3,
          emptyMessage: 'Nothing linked yet.',
        },
      ]

/**
 * The record-bound sheet a row click opens: the title in its header, the fields
 * editable in place, the first related rows, and a footer action.
 */
const recordSheet = (p: P, sheetId: string): Node => ({
  type: 'sheet',
  id: sheetId,
  props: { title: `$record.${p('titleField')}` },
  drawerSide: 'right',
  drawerSize: 'md',
  dataSource: { table: p('table') },
  canEdit: true,
  recordFields: [
    {
      name: p('titleField'),
      type: 'single-line-text',
      label: labelOf(p, 'titleLabel', 'titleField'),
    },
    { name: p('statusField'), type: 'status', label: labelOf(p, 'statusLabel', 'statusField') },
  ],
  related: relatedRows(p),
  navigation: {
    siblings: true,
    ...(p('fullPagePath') === '' ? {} : { fullPage: p('fullPagePath') }),
  },
  actions: [
    {
      label: 'Delete',
      variant: 'destructive',
      action: { type: 'crud', operation: 'delete', table: p('table') },
      confirm: {
        title: `Delete $record.${p('titleField')}?`,
        message: 'The record and what links only to it are deleted. This cannot be undone.',
        confirmLabel: 'Delete',
      },
    },
  ],
})

/** A grid whose rows open the record in a sheet, stepping through the grid from there. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'record-sheet',
  title: 'Record sheet',
  category: 'console',
  shadcnBlock: null,
  tags: ['sheet', 'drawer', 'record', 'detail', 'slide-over', 'table', 'previous', 'next'],
  description:
    'A data grid over one of your tables whose rows open the record in a sheet on the right — its title, its fields editable in place, the first related rows and a delete — with Previous and Next through the grid and a link to the record’s full page.',
  notes: [
    'No shadcn counterpart: shadcn/ui has a Sheet component but no record-detail block, so this block pairs a `table` with a `type: sheet` bound to the same table and opened from a row.',
    PLACE_NOTE,
    DATA_NOTE,
    'Nothing opens until a row is clicked. The sheet writes `?record=<id>` into the address, so a record can be shared by link; Previous and Next follow the grid’s own order and filter.',
    'Each column and field is labelled by its field name in words — `due_date` reads "Due date" — until you set `titleLabel` or `statusLabel`; the related rows are headed by the child table name in words until you set `childLabel`.',
    'Set `fullPagePath` to the record page — `/projects/$record.id` — to draw "Open full page"; leave it empty to omit it. Set `childTable` and `parentField` to list the first three linked records under the fields.',
    THEME_NOTE,
  ],
  params: [
    stringParam('headline', 'The page heading above the grid. Empty to omit.', '[Projects]'),
    stringParam('table', 'The table the records are read from.', 'projects'),
    stringParam('titleField', 'The text field naming each record.', 'title'),
    stringParam('statusField', 'The status or single-select field.', 'status'),
    stringParam(
      'titleLabel',
      "The title column's header and field label. Empty reads as the field name in words.",
      ''
    ),
    stringParam(
      'statusLabel',
      "The status column's header and field label. Empty reads as the field name in words.",
      ''
    ),
    stringParam('fullPagePath', 'The record page, with `$record.id`. Empty to omit.', ''),
    stringParam('childTable', 'A table whose records point at these. Empty to omit.', ''),
    stringParam('parentField', 'The child table’s relationship field pointing here.', ''),
    stringParam(
      'childLabel',
      'The heading of the related rows. Empty reads as the child table name in words.',
      ''
    ),
    stringParam(
      'emptyMessage',
      'What the grid says when it has no record.',
      'No record yet. Create one to see it here.'
    ),
  ],
  tables: [
    {
      param: 'table',
      fields: [
        { name: 'title', param: 'titleField', type: 'single-line-text' },
        { name: 'status', param: 'statusField', type: 'status' },
      ],
    },
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    const sheetId = `${name}-detail`
    return asComponent(
      name,
      panel([
        stack(
          [
            // The page's own heading: the grid and its sheet are the whole page.
            ...(p('headline') === '' ? [] : [panelHead(p('headline'), '', 'h1')]),
            {
              type: 'table',
              dataSource: { table: p('table') },
              columns: [
                {
                  field: p('titleField'),
                  label: labelOf(p, 'titleLabel', 'titleField'),
                  editable: false,
                },
                {
                  field: p('statusField'),
                  label: labelOf(p, 'statusLabel', 'statusField'),
                  editable: false,
                },
              ],
              onRowClick: { action: 'openSheet', component: sheetId },
              phoneLayout: 'rows',
              emptyMessage: p('emptyMessage'),
            },
            recordSheet(p, sheetId),
          ],
          'gap-4'
        ),
      ])
    )
  },
})
