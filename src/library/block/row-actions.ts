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

type P = (key: string) => string

/** `low,medium,high` → `[{ value: 'low' }, …]`, blanks dropped. */
const choices = (list: string): ReadonlyArray<{ readonly value: string }> =>
  list
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value !== '')
    .map((value) => ({ value }))

/**
 * The row's menu: a plain action, a choice among values (a submenu) and a
 * destructive action behind a confirmation, in the order shadcn/ui lists them.
 */
const rowMenu = (p: P): readonly Readonly<Record<string, unknown>>[] => {
  const table = p('table')
  const status = p('statusField')
  const priority = p('priorityField')
  const priorityLabel = labelOf(p, 'priorityLabel', 'priorityField')
  return [
    {
      label: 'Mark as done',
      icon: 'check',
      visibleWhen: { field: status, neq: p('doneValue') },
      action: { type: 'crud', operation: 'update', table, data: { [status]: p('doneValue') } },
    },
    {
      label: priorityLabel,
      icon: 'signal',
      editSelect: {
        field: priority,
        label: priorityLabel,
        saveLabel: 'Save',
        options: choices(p('priorityChoices')),
      },
      // A `fetch` to the records API rather than a `crud` update: the picked value
      // reaches the request through `$record.<field>`, which a fetch body fills in.
      action: {
        type: 'fetch',
        url: `/api/tables/${table}/records/$record.id`,
        method: 'PATCH',
        body: { [priority]: `$record.${priority}` },
      },
    },
    {
      label: 'Delete',
      icon: 'trash-2',
      variant: 'destructive',
      confirm: {
        title: `Delete $record.${p('titleField')}?`,
        message: 'The record is deleted for good. This cannot be undone.',
        confirmLabel: 'Delete',
      },
      action: { type: 'crud', operation: 'delete', table },
    },
  ]
}

/** A grid whose rows each carry a `…` menu of actions. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'row-actions',
  title: 'Row actions menu',
  category: 'console',
  shadcnBlock: null,
  tags: ['table', 'grid', 'records', 'row actions', 'menu', 'dropdown', 'confirm'],
  description:
    'A data grid over one of your tables whose rows each end in a `…` button opening a menu: mark the record done, change its priority from a submenu, or delete it after a confirmation that names it.',
  notes: [
    'No shadcn counterpart: shadcn/ui draws row actions inside its data table guide rather than as a block, so this block sets `rowActions.display: menu` on a `table` to give the same per-row menu.',
    PLACE_NOTE,
    DATA_NOTE,
    'Each column is headed by its field name in words — `due_date` reads "Due date" — until you set its label parameter: `--set titleLabel=Task`.',
    '"Mark as done" writes `doneValue` into the status field and is left out of the menu of a row that already holds it. The priority item opens a submenu of `priorityChoices` — a comma-separated list of the field’s option values — with the row’s current value marked. "Delete" asks in a dialog over the page before it removes anything.',
    'Each item is an ordinary action of the column, so `visibleWhen`, `confirm` and `variant` work as they do inline; set `rowActions.display: inline` to draw the same actions as buttons. The grid respects your table permissions.',
    THEME_NOTE,
  ],
  params: [
    stringParam('headline', 'The heading above the grid. Empty to omit.', '[Tasks]'),
    stringParam('table', 'The table the rows are read from.', 'tasks'),
    stringParam('titleField', 'The text field naming each record.', 'title'),
    stringParam('statusField', 'The status or single-select field.', 'status'),
    stringParam('doneValue', 'The status value "Mark as done" writes.', 'done'),
    stringParam('priorityField', 'The single-select field the submenu edits.', 'priority'),
    stringParam(
      'titleLabel',
      "The title column's header. Empty reads as the field name in words.",
      ''
    ),
    stringParam(
      'statusLabel',
      "The status column's header. Empty reads as the field name in words.",
      ''
    ),
    stringParam(
      'priorityLabel',
      "The priority column's header, also the submenu's. Empty reads as the field name in words.",
      ''
    ),
    stringParam(
      'priorityChoices',
      'The values the submenu offers, comma-separated.',
      'low,medium,high'
    ),
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
        { name: 'title', param: 'titleField', type: 'single-line-text' },
        { name: 'status', param: 'statusField', type: 'status' },
        { name: 'priority', param: 'priorityField', type: 'single-select' },
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
          [
            ...(p('headline') === '' ? [] : [panelHead(p('headline'))]),
            {
              type: 'table',
              dataSource: { table: p('table') },
              rowActions: { display: 'menu' },
              columns: [
                { field: p('titleField'), label: labelOf(p, 'titleLabel', 'titleField') },
                { field: p('statusField'), label: labelOf(p, 'statusLabel', 'statusField') },
                {
                  field: p('priorityField'),
                  label: labelOf(p, 'priorityLabel', 'priorityField'),
                },
                { type: 'actions', label: '', actions: rowMenu(p) },
              ],
              pagination: { pageSize: 25 },
              emptyMessage: p('emptyMessage'),
            },
          ],
          'gap-4'
        ),
      ])
    )
  },
})
