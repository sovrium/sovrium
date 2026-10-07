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

type Node = Readonly<Record<string, unknown>>
type P = (key: string) => string

/** The first three children of the opened record, when the block names a child table. */
const relatedRows = (p: P): readonly Node[] =>
  p('childTable') === ''
    ? []
    : [
        {
          label: p('childLabel'),
          table: p('childTable'),
          field: p('parentField'),
          limit: 3,
          emptyMessage: 'Nothing linked yet.',
        },
      ]

/** The record-bound panel a row click opens: title, status, facts, the first related rows. */
const recordDrawer = (p: P, drawerId: string): Node => ({
  type: 'drawer',
  id: drawerId,
  props: { title: `$record.${p('titleField')}` },
  drawerSide: 'right',
  drawerSize: 'md',
  dataSource: { table: p('table') },
  canEdit: true,
  recordFields: [
    { name: p('titleField'), type: 'single-line-text', label: '[Name]' },
    { name: p('statusField'), type: 'status', label: '[Status]' },
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

/** A list whose rows open the record in a side panel, stepping through the list from there. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'drawer-record',
  title: 'Record detail in a side panel',
  category: 'application',
  tags: ['drawer', 'record', 'detail', 'slide-over', 'table', 'previous', 'next'],
  description:
    'A list over one of your tables whose rows open the record in a 480 px panel on the right — title, status, its fields editable in place, the first related rows — with Previous and Next through the list and a link to the record’s full page.',
  notes: [
    PLACE_NOTE,
    DATA_NOTE,
    'Nothing opens until a row is clicked. The panel writes `?record=<id>` into the address, so a record can be shared by link; Previous and Next follow the list’s own order and filter.',
    'Set `fullPagePath` to the record page — `/projects/$record.id` — to draw "Open full page"; leave it empty to omit it. Set `childTable` and `parentField` to list the first three linked records under the fields.',
    THEME_NOTE,
  ],
  params: [
    stringParam('headline', 'The heading above the list. Empty to omit.', '[Projects]'),
    stringParam('table', 'The table the records are read from.', 'projects'),
    stringParam('titleField', 'The text field naming each record.', 'title'),
    stringParam('statusField', 'The status or single-select field.', 'status'),
    stringParam('fullPagePath', 'The record page, with `$record.id`. Empty to omit.', ''),
    stringParam('childTable', 'A table whose records point at these. Empty to omit.', ''),
    stringParam('parentField', 'The child table’s relationship field pointing here.', ''),
    stringParam('childLabel', 'The heading of the related rows.', '[Linked records]'),
    stringParam(
      'emptyMessage',
      'What the list says when it has no record.',
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
    const drawerId = `${name}-detail`
    return asComponent(
      name,
      panel([
        stack(
          [
            ...(p('headline') === '' ? [] : [panelHead(p('headline'))]),
            {
              type: 'table',
              dataSource: { table: p('table') },
              columns: [
                { field: p('titleField'), label: '[Name]', editable: false },
                { field: p('statusField'), label: '[Status]', editable: false },
              ],
              onRowClick: { action: 'openDrawer', component: drawerId },
              phoneLayout: 'rows',
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
