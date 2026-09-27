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

/** The record-bound panel a row click opens: every field, editable, and a guarded delete. */
const recordDrawer = (
  p: (key: string) => string,
  drawerId: string
): Readonly<Record<string, unknown>> => ({
  type: 'drawer',
  id: drawerId,
  props: { title: '[Record]' },
  drawerSide: 'right',
  drawerSize: 'md',
  dataSource: { table: p('table') },
  canEdit: true,
  recordFields: [
    { name: p('referenceField'), type: 'single-line-text', label: '[Reference]' },
    { name: p('clientField'), type: 'single-line-text', label: '[Client]' },
    { name: p('amountField'), type: 'decimal', label: '[Amount]' },
    { name: p('dateField'), type: 'date', label: '[Date]' },
  ],
  actions: [
    {
      label: 'Delete',
      variant: 'destructive',
      action: { type: 'crud', operation: 'delete', table: p('table') },
      confirm: {
        title: 'Delete this record?',
        message: 'The record and its history are deleted. This cannot be undone.',
        confirmLabel: 'Delete',
      },
    },
  ],
})

/** A table whose row click opens the record's details in a side panel. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'drawer-record',
  title: 'Record detail in a side panel',
  category: 'application',
  tags: ['drawer', 'record', 'detail', 'slide-over', 'table'],
  description:
    'A table over one of your tables whose rows open the record in a panel on the right — every field shown and editable in place, with a delete action at the foot that asks first.',
  notes: [
    PLACE_NOTE,
    DATA_NOTE,
    'The panel also opens from a link carrying `?record=<id>`, so a record can be shared by URL. Set `canEdit` to `false` on the drawer in your copy to make it read-only.',
    THEME_NOTE,
  ],
  params: [
    stringParam('headline', 'The heading above the table. Empty to omit.', '[Invoices]'),
    stringParam('table', 'The table the records are read from.', 'invoices'),
    stringParam('referenceField', 'A text field — a number or a name.', 'reference'),
    stringParam('clientField', 'A second text field.', 'client'),
    stringParam('amountField', 'A number field.', 'amount'),
    stringParam('dateField', 'A date field.', 'issued_on'),
    stringParam(
      'emptyMessage',
      'What the table says when it has no record.',
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
    const table = p('table')
    const drawerId = `${name}-detail`
    return asComponent(
      name,
      panel([
        stack(
          [
            ...(p('headline') === '' ? [] : [panelHead(p('headline'))]),
            {
              type: 'table',
              dataSource: { table },
              columns: [
                { field: p('referenceField'), label: '[Reference]' },
                { field: p('clientField'), label: '[Client]' },
                { field: p('amountField'), label: '[Amount]', align: 'right' },
                { field: p('dateField'), label: '[Date]', format: 'short-date' },
              ],
              onRowClick: { action: 'openDrawer', component: drawerId },
              emptyMessage: p('emptyMessage'),
            },
            recordDrawer(p, drawerId),
          ],
          'gap-4'
        ),
      ])
    )
  },
})
