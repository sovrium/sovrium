/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `table` — two components sharing one name, and the page draws both.
//
// Declare `tableRows` and you get a static table: the rows are in the config,
// nothing is fetched, and nothing sorts or pages. Declare `dataSource` and you
// get the grid: rows come from a table or an endpoint, and sorting, paging,
// grouping, selection and inline editing come with them. The two are refused
// together by name — a binding would win and the authored rows would vanish
// with no symptom — so choosing between them is the first decision this type
// asks for, and the only one that cannot be changed later without a rewrite.
//
// ─── WHAT IS DRAWN AND WHAT IS COMPOSED ────────────────────────────────────
//
// Every bound drawing reads the platform's own specimen rows, which carry a
// name, a role, a status, a priority, an amount, a boolean and two dates, and
// belong to nobody. That is enough to draw the grid's whole READ surface for
// real: the formats, the alignment, the grouping, the summaries, the paging,
// the empty state.
//
// The grid's WRITE surface cannot be drawn here at all. Saving, the cell
// editors, the fill handle, the trailing add row and every bulk action are live
// writes, and a preview frame may carry no write path. Those sections are
// composed from other kit types and say so once, under their own heading. They
// are worth composing rather than omitting: the states that matter are the ones
// a reader meets when something refuses — a stale write, a value a column
// cannot hold, a row that will not commit because a required field is empty.

import { SPECIMEN_ROWS_ENDPOINT } from '../../../system-sources'
import type { PageComponent, TypePageBody } from './body-shape'

const BOUND = {
  system: {
    endpoint: SPECIMEN_ROWS_ENDPOINT,
    rowsKey: 'items',
    idKey: 'id',
    totalKey: 'total',
    query: { rows: '3' },
  },
}

const EMPTY = {
  system: {
    endpoint: SPECIMEN_ROWS_ENDPOINT,
    rowsKey: 'items',
    idKey: 'id',
    totalKey: 'total',
    query: { rows: '0' },
  },
}

const COLUMNS = [
  { field: 'name', label: 'Name' },
  { field: 'role', label: 'Role' },
  { field: 'status', label: 'Status' },
]

/** The same grid every time, with one key changed. */
const grid = (id: string, extra: Record<string, unknown> = {}) =>
  ({
    type: 'table' as const,
    props: { id, 'aria-label': 'Specimen rows' },
    dataSource: BOUND,
    columns: COLUMNS,
    emptyMessage: 'No specimen rows',
    ...extra,
  }) as PageComponent

// ─── COMPOSITION HELPERS, FOR THE WRITE SURFACE ────────────────────────────

/** One cell, framed as the grid frames it. */
const cell = (children: readonly unknown[], className = ''): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className:
        `border-border flex min-w-40 items-center gap-2 rounded-md border px-3 py-1.5 ${className}`.trim(),
    },
    children,
  }) as PageComponent

const txt = (content: string, className = 'text-foreground text-sm'): PageComponent =>
  ({ type: 'text', element: 'span', content, props: { className } }) as PageComponent

/**
 * A label INSIDE a control, which declares no colour of its own.
 *
 * `txt` paints `text-foreground` — the page's ink, correct on the page's
 * ground. Inside a filled button the ground is the primary fill, and the
 * button's own recipe already sets the ink to match it
 * (`text-[var(--sv-primary-fg)]`). A child span re-declaring `text-foreground`
 * overrides that and paints near-black on near-black: measured 2026-09-16 at
 * **1.11:1** on the six filled buttons of this page. So a label in a control
 * says only how big it is, and inherits what colour the control is wearing —
 * which is also what makes it correct on `secondary` and `destructive` without
 * knowing which one it is in.
 *
 * It stays a `text` child rather than the button's own `label` key, because a
 * button with no children is a CONTENTLESS element and takes the placeholder
 * `style="display:inline-block"` from `buildEmptyElementStyles`, which overrules
 * the recipe's `inline-flex items-center justify-center`.
 */
const btnLabel = (content: string): PageComponent => txt(content, 'text-sm')

const mono = (content: string): PageComponent =>
  txt(content, 'text-foreground font-mono text-[11px]')

const muted = (content: string): PageComponent => txt(content, 'text-foreground-subtle text-[11px]')

const stack = (children: readonly unknown[], className = 'flex flex-col gap-2'): PageComponent =>
  ({ type: 'container', element: 'div', props: { className }, children }) as PageComponent

const panel = (children: readonly unknown[]): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className:
        'border-border bg-background-raised flex flex-col gap-2 rounded-md border p-3 shadow-md',
    },
    children,
  }) as PageComponent

/** A read cell drawn as one field type renders it. */
const renderer = (label: string, drawing: PageComponent, why?: string) => ({
  label,
  ...(why === undefined ? {} : {}),
  children: [cell([drawing])],
})

const table: TypePageBody = {
  drawings: [
    {
      label: 'static rows',
      children: [
        {
          type: 'table',
          tableHeaders: ['Plan', 'Records', 'Seats'],
          tableRows: [
            ['Starter', '10 000', '3'],
            ['Team', '100 000', '20'],
            ['Scale', 'Unlimited', 'Unlimited'],
          ],
          caption: 'Written in the config, not fetched.',
        } as PageComponent,
      ],
    },
    {
      label: 'bound to a source',
      children: [grid('design-system-table-bound')],
    },
    {
      label: 'dense',
      children: [grid('design-system-table-dense', { rowHeight: 'short' })],
    },
    {
      label: 'grouped',
      children: [grid('design-system-table-grouped', { groupBy: { field: 'status' } })],
    },
  ],
  options: [
    {
      id: 'rows',
      title: 'Rows',
      configKey: 'table.tableRows | dataSource | columnsFrom',
      drawings: [
        {
          label: 'tableRows: [ … ]',
          children: [
            {
              type: 'table',
              tableHeaders: ['Plan', 'Seats'],
              tableRows: [
                ['Starter', '3'],
                ['Team', '20'],
              ],
            } as PageComponent,
          ],
        },
        {
          label: 'dataSource: { system: { endpoint } }',
          children: [grid('tbl-rows-system')],
        },
        {
          label: 'dataSource: { table }',
          children: [
            {
              type: 'code',
              props: { language: 'yaml' },
              content:
                'dataSource:\n  table: deals\n  filter:\n    - field: status\n      operator: eq\n      value: won',
            } as PageComponent,
          ],
        },
        {
          label: 'columnsFrom: table',
          children: [
            {
              type: 'code',
              props: { language: 'yaml' },
              content: 'columnsFrom: table',
            } as PageComponent,
          ],
        },
      ],
    },
    {
      id: 'row-height',
      title: 'Row height',
      configKey: 'table.rowHeight',
      drawings: (['short', 'medium', 'tall'] as const).map((rowHeight) => ({
        label: `rowHeight: '${rowHeight}'`,
        ...(rowHeight === 'medium' ? {} : {}),
        children: [grid(`tbl-height-${rowHeight}`, { rowHeight })],
      })),
    },
    {
      id: 'row-treatment',
      title: 'Row treatment',
      configKey: 'table.striped | bordered | showRowNumbers | rowColorField',
      drawings: [
        {
          label: 'striped: true',
          children: [grid('tbl-striped', { striped: true })],
        },
        {
          label: 'bordered: true',
          children: [grid('tbl-bordered', { bordered: true })],
        },
        {
          label: 'showRowNumbers: true',
          children: [grid('tbl-numbers', { showRowNumbers: true })],
        },
        {
          label: "rowColorField: 'priority'",
          children: [grid('tbl-rowcolor', { rowColorField: 'priority' })],
        },
      ],
    },
    {
      id: 'columns',
      title: 'Columns',
      configKey: 'table.columns[]',
      drawings: [
        {
          label: "label: 'Full name'",
          children: [
            grid('tbl-col-label', {
              columns: [{ field: 'name', label: 'Full name' }, ...COLUMNS.slice(1)],
            }),
          ],
        },
        {
          label: 'width: 120 · minWidth: 80',
          children: [
            grid('tbl-col-width', {
              columns: [
                { field: 'name', label: 'Name', width: 120, minWidth: 80 },
                ...COLUMNS.slice(1),
              ],
            }),
          ],
        },
        ...(['left', 'center', 'right'] as const).map((align) => ({
          label: `align: '${align}'`,
          ...(align === 'right' ? {} : align === 'left' ? {} : {}),
          children: [
            grid(`tbl-col-${align}`, {
              columns: [
                { field: 'name', label: 'Name' },
                { field: 'amount', label: 'Amount', align, format: 'currency' },
              ],
            }),
          ],
        })),
        {
          label: 'frozen: true',
          children: [
            grid('tbl-col-frozen', {
              columns: [
                { field: 'name', label: 'Name', frozen: true, width: 160 },
                { field: 'role', label: 'Role' },
                { field: 'status', label: 'Status' },
                { field: 'priority', label: 'Priority' },
                { field: 'amount', label: 'Amount', format: 'currency' },
              ],
            }),
          ],
        },
        {
          label: 'sortable: false',
          children: [
            grid('tbl-col-sortable', {
              columns: [
                { field: 'name', label: 'Name' },
                { field: 'role', label: 'Role', sortable: false },
              ],
            }),
          ],
        },
        {
          label: 'visible: false',
          children: [
            grid('tbl-col-visible', {
              columns: [...COLUMNS, { field: 'amount', label: 'Amount', visible: false }],
              toolbar: { columnToggle: true },
            }),
          ],
        },
        {
          label: 'valueLabels: { … }',
          children: [
            grid('tbl-col-labels', {
              columns: [
                { field: 'name', label: 'Name' },
                {
                  field: 'status',
                  label: 'Status',
                  valueLabels: { Active: 'In flight', Paused: 'On hold' },
                },
              ],
            }),
          ],
        },
        {
          label: 'cellStyle: [{ when, style }]',
          children: [
            grid('tbl-col-style', {
              columns: [
                { field: 'name', label: 'Name' },
                {
                  field: 'amount',
                  label: 'Amount',
                  format: 'currency',
                  align: 'right',
                  cellStyle: [{ when: { gt: 1000 }, className: 'font-semibold' }],
                },
              ],
            }),
          ],
        },
      ],
    },
    {
      id: 'formats',
      title: 'Formats',
      configKey: 'table.columns[].format',
      drawings: [
        {
          label: "format: 'truncate'",
          children: [
            grid('tbl-fmt-truncate', {
              columns: [{ field: 'name', label: 'Name', width: 90, format: 'truncate' }],
            }),
          ],
        },
        ...(['currency', 'percentage', 'compact', 'bytes'] as const).map((format) => ({
          label: `format: '${format}'`,
          children: [
            grid(`tbl-fmt-${format}`, {
              columns: [
                { field: 'name', label: 'Name' },
                { field: 'amount', label: 'Amount', format, align: 'right' },
              ],
            }),
          ],
        })),
        ...(['relative-date', 'short-date', 'long-date', 'datetime'] as const).map((format) => ({
          label: `format: '${format}'`,
          ...(format === 'relative-date' ? {} : {}),
          children: [
            grid(`tbl-fmt-${format}`, {
              columns: [
                { field: 'name', label: 'Name' },
                { field: 'startsAt', label: 'Starts', format },
              ],
            }),
          ],
        })),
        {
          label: "format: 'relative-time'",
          children: [
            grid('tbl-fmt-relative-time', {
              columns: [
                { field: 'name', label: 'Name' },
                { field: 'endsAt', label: 'Ends', format: 'relative-time' },
              ],
            }),
          ],
        },
        ...(['yes-no', 'check-cross'] as const).map((format) => ({
          label: `format: '${format}'`,
          ...(format === 'check-cross' ? {} : {}),
          children: [
            grid(`tbl-fmt-${format}`, {
              columns: [
                { field: 'name', label: 'Name' },
                { field: 'active', label: 'Active', format },
              ],
            }),
          ],
        })),
      ],
    },
    {
      id: 'selection',
      title: 'Selection',
      configKey: 'table.selection | bulkActions',
      drawings: [
        {
          label: "selection: { mode: 'none' }",
          children: [grid('tbl-sel-none', { selection: { mode: 'none' } })],
        },
        {
          label: "selection: { mode: 'single' }",
          children: [grid('tbl-sel-single', { selection: { mode: 'single' } })],
        },
        {
          label: "selection: { mode: 'multiple' }",
          children: [grid('tbl-sel-multi', { selection: { mode: 'multiple' } })],
        },
        {
          label: 'showCheckboxes: false',
          children: [
            grid('tbl-sel-nocheck', { selection: { mode: 'multiple', showCheckboxes: false } }),
          ],
        },
        {
          label: 'bulkActions: [ … ]',
          children: [
            panel([
              stack(
                [
                  txt('2 selected'),
                  { type: 'button', variant: 'secondary', children: [btnLabel('Archive 2 items')] },
                ],
                'flex items-center gap-3'
              ),
            ]),
          ],
        },
      ],
    },
    {
      id: 'toolbar',
      title: 'Toolbar',
      configKey: 'table.toolbar.*',
      drawings: [
        {
          label: 'toolbar: { search: true }',
          children: [grid('tbl-tb-search', { toolbar: { search: true } })],
        },
        {
          label: 'toolbar: { filters: true, sort: true }',
          children: [grid('tbl-tb-filter', { toolbar: { filters: true, sort: true } })],
        },
        {
          label: 'toolbar: { groupBy: true, columnToggle: true }',
          children: [grid('tbl-tb-group', { toolbar: { groupBy: true, columnToggle: true } })],
        },
        {
          label: 'toolbar: { export: true, refresh: true, density: true }',
          children: [
            grid('tbl-tb-rest', { toolbar: { export: true, refresh: true, density: true } }),
          ],
        },
        {
          label: 'toolbar: { views: true, viewSwitcher: true }',
          children: [
            grid('tbl-tb-views', {
              toolbar: { views: true, viewSwitcher: true },
              views: ['grid', 'kanban'],
              kanbanGroupBy: { field: 'status' },
            }),
          ],
        },
        {
          label: '+ New record · Import',
          children: [
            stack(
              [
                { type: 'button', children: [btnLabel('+ New record')] },
                { type: 'button', variant: 'secondary', children: [btnLabel('Import')] },
              ],
              'flex items-center gap-2'
            ),
          ],
        },
      ],
    },
    {
      id: 'grouping',
      title: 'Grouping',
      configKey: 'table.groupBy',
      drawings: [
        {
          label: "groupBy: { field: 'status' }",
          children: [grid('tbl-grp-one', { groupBy: { field: 'status' } })],
        },
        {
          label: "groupBy: { field: 'status', thenBy: [{ field: 'priority' }] }",
          children: [
            grid('tbl-grp-two', {
              groupBy: { field: 'status', thenBy: [{ field: 'priority' }] },
            }),
          ],
        },
        {
          label: 'collapsed: true',
          children: [grid('tbl-grp-collapsed', { groupBy: { field: 'status', collapsed: true } })],
        },
        {
          label: "direction: 'desc'",
          children: [grid('tbl-grp-desc', { groupBy: { field: 'status', direction: 'desc' } })],
        },
        {
          label: 'with summaries',
          children: [
            grid('tbl-grp-summary', {
              columns: [
                ...COLUMNS,
                { field: 'amount', label: 'Amount', format: 'currency', align: 'right' },
              ],
              groupBy: { field: 'status' },
              summary: [{ field: 'amount', function: 'sum', label: 'Total' }],
            }),
          ],
        },
      ],
    },
    {
      id: 'summary',
      title: 'Summary',
      configKey: 'table.summary[]',
      drawings: [
        {
          label: "summary: [{ field: 'amount', function: 'sum', label: 'Total' }]",
          children: [
            grid('tbl-sum', {
              columns: [
                ...COLUMNS,
                { field: 'amount', label: 'Amount', format: 'currency', align: 'right' },
              ],
              summary: [{ field: 'amount', function: 'sum', label: 'Total' }],
            }),
          ],
        },
      ],
    },
    {
      id: 'pagination',
      title: 'Pagination',
      configKey: 'table.pagination',
      drawings: [
        ...(['bottom', 'top', 'both'] as const).map((position) => ({
          label: `pagination: { position: '${position}' }`,
          ...(position === 'both' ? {} : {}),
          children: [grid(`tbl-pag-${position}`, { pagination: { position } })],
        })),
        {
          label: 'pageSize: 2 · pageSizeOptions: [2, 10, 25]',
          children: [
            grid('tbl-pag-size', { pagination: { pageSize: 2, pageSizeOptions: [2, 10, 25] } }),
          ],
        },
        {
          label: 'serverSide: true',
          children: [grid('tbl-pag-server', { pagination: { serverSide: true, pageSize: 2 } })],
        },
        {
          label: 'loadMore',
          children: [
            {
              type: 'code',
              props: { language: 'yaml' },
              content:
                'pagination:\n  position: bottom\n  pageSize: 25\n  pageSizeOptions: [10, 25, 50]\n  serverSide: true',
            } as PageComponent,
          ],
        },
      ],
    },
    {
      id: 'views',
      title: 'Views',
      configKey: 'table.views[] | viewLabels | kanbanGroupBy | dateField',
      drawings: [
        {
          label: "views: ['grid', 'kanban'] · kanbanGroupBy",
          children: [
            grid('tbl-view-kanban', {
              views: ['grid', 'kanban'],
              kanbanGroupBy: { field: 'status' },
              toolbar: { viewSwitcher: true },
            }),
          ],
        },
        {
          label: "views: ['grid', 'calendar'] · dateField",
          children: [
            grid('tbl-view-calendar', {
              views: ['grid', 'calendar'],
              dateField: 'startsAt',
              toolbar: { viewSwitcher: true },
            }),
          ],
        },
        {
          label: "views: ['grid', 'gallery']",
          children: [
            grid('tbl-view-gallery', {
              views: ['grid', 'gallery'],
              toolbar: { viewSwitcher: true },
            }),
          ],
        },
        {
          label: 'viewLabels: { … }',
          children: [
            grid('tbl-view-labels', {
              views: ['grid', 'kanban'],
              kanbanGroupBy: { field: 'status' },
              viewLabels: { grid: 'List', kanban: 'Pipeline' },
              toolbar: { viewSwitcher: true },
            }),
          ],
        },
      ],
    },
    {
      id: 'empty',
      title: 'Empty states',
      configKey: 'table.emptyMessage | noMatchMessage',
      drawings: [
        {
          label: "emptyMessage: '…'",
          children: [
            {
              type: 'table',
              props: { id: 'tbl-empty', 'aria-label': 'No rows' },
              dataSource: EMPTY,
              columns: COLUMNS,
              emptyMessage: 'No items yet. Import a CSV or add the first one.',
            } as PageComponent,
          ],
        },
        {
          label: "noMatchMessage: 'Nothing matches {query}.'",
          children: [stack([txt('Nothing matches “zzz”.'), muted('No results')])],
        },
        {
          label: 'loading',
          children: [
            stack([
              { type: 'skeleton' } as PageComponent,
              { type: 'skeleton' } as PageComponent,
              { type: 'skeleton' } as PageComponent,
            ]),
          ],
        },
      ],
    },
    {
      id: 'actions',
      title: 'Actions column',
      configKey: "table.columns[] { type: 'actions' }",
      drawings: [
        {
          label: 'actions: [edit, setStatus, delete]',
          children: [
            cell([
              {
                type: 'button',
                variant: 'secondary',
                children: [btnLabel('Edit')],
              } as PageComponent,
              {
                type: 'button',
                variant: 'secondary',
                children: [btnLabel('Delete')],
              } as PageComponent,
            ]),
          ],
        },
        {
          label: "icon: 'pencil' | 'trash'",
          children: [cell([txt('✎'), txt('🗑')])],
        },
        {
          label: "confirm: 'Delete this item?'",
          children: [
            panel([
              txt('Delete this item?'),
              stack(
                [
                  { type: 'button', variant: 'secondary', children: [btnLabel('Cancel')] },
                  { type: 'button', children: [btnLabel('Delete')] },
                ],
                'flex justify-end gap-2'
              ),
            ]),
          ],
        },
        {
          label: 'confirm: { title, message, typeToConfirm }',
          children: [
            panel([
              txt('Delete Acme Europe'),
              muted(
                'This removes the record and everything linked to it. Type the name to confirm.'
              ),
              {
                type: 'input',
                props: { name: 'confirm', placeholder: 'Acme Europe' },
              } as PageComponent,
            ]),
          ],
        },
        {
          label: "editSelect: { field: 'status' }",
          children: [panel([txt('Active'), txt('Paused')])],
        },
        {
          label: 'visibleWhen: { field, eq }',
          children: [
            cell([
              {
                type: 'button',
                variant: 'secondary',
                children: [btnLabel('Restore')],
              } as PageComponent,
            ]),
          ],
        },
        {
          label: "capability: 'items.delete'",
          children: [cell([muted('— no actions for this role —')])],
        },
      ],
    },
    {
      id: 'filters',
      title: 'Filter vocabulary',
      configKey: 'dataSource.filter[].operator | toolbar.filters',
      drawings: [
        {
          label: 'the server’s eight',
          children: [cell([mono('eq · neq · contains · gt · lt · gte · lte · in')])],
        },
        {
          label: 'text (6)',
          children: [
            cell([mono('is · is not · contains · does not contain · is empty · is not empty')]),
          ],
        },
        { label: 'number (7)', children: [cell([mono('= · ≠ · > · < · ≥ · ≤ · between')])] },
        {
          label: 'date (5)',
          children: [cell([mono('is · is before · is after · is on or before · is on or after')])],
        },
        { label: 'select (4)', children: [cell([mono('is · is not · is any of · is none of')])] },
      ],
    },
    {
      id: 'row-expand',
      title: 'Row expand',
      configKey: 'table.rowExpand | onRowClick',
      drawings: [
        {
          label: 'rowExpand: true',
          children: [
            panel([
              txt('Ada Lovelace'),
              muted('Name · Role · Status · Priority · Amount'),
              { type: 'button', children: [btnLabel('Save')] } as PageComponent,
            ]),
          ],
        },
        {
          label: 'rowExpand: { fields, canEdit: false, title }',
          children: [panel([txt('Item'), muted('Name: Ada Lovelace'), muted('Amount: €1,240.50')])],
        },
        {
          label: 'onRowClick: navigate',
          children: [
            cell([
              {
                type: 'link',
                props: { href: '#', className: 'text-primary text-sm' },
                content: 'Ada Lovelace',
              } as PageComponent,
            ]),
          ],
        },
        {
          label: 'onRowClick: openDrawer',
          children: [cell([txt('Ada Lovelace'), muted('opens the drawer')])],
        },
      ],
    },
    {
      id: 'saving',
      title: 'Saving',
      configKey: 'table.autoSave',
      drawings: [
        { label: "saveMode: 'auto'", children: [cell([txt('Acme Europ'), muted('saving…')])] },
        { label: "saveMode: 'onBlur'", children: [cell([txt('Acme Europe'), muted('Saved')])] },
        {
          label: "saveMode: 'manual'",
          children: [
            stack([
              cell([txt('Acme Europe')]),
              stack(
                [
                  { type: 'button', children: [btnLabel('Save changes')] },
                  { type: 'button', variant: 'secondary', children: [btnLabel('Discard')] },
                ],
                'flex gap-2'
              ),
            ]),
          ],
        },
        { label: "indicator: 'inline'", children: [cell([txt('Acme Europe'), muted('Saved')])] },
        { label: "indicator: 'toast'", children: [panel([txt('Saved')])] },
        { label: "indicator: 'toolbar'", children: [cell([muted('All changes saved')])] },
        {
          label: 'conflict',
          children: [
            panel([
              txt('This record changed while you were editing it.'),
              muted('Grace Hopper saved a different value two minutes ago.'),
              stack(
                [
                  { type: 'button', variant: 'secondary', children: [btnLabel('Reload theirs')] },
                  { type: 'button', children: [btnLabel('Keep mine')] },
                ],
                'flex justify-end gap-2'
              ),
            ]),
          ],
        },
      ],
    },
    {
      id: 'renderers',
      title: 'Cell renderers',
      configKey: 'field type → cell',
      drawings: [
        renderer(
          'user',
          stack(
            [
              { type: 'avatar', initials: 'AL', label: 'Ada Lovelace' } as PageComponent,
              txt('Ada Lovelace'),
            ],
            'flex items-center gap-2'
          )
        ),
        renderer(
          'relationship',
          {
            type: 'badge',
            badgeVariant: 'secondary',
            children: [txt('Acme Europe')],
          } as PageComponent,
          'A linked-record pill; a click opens the record drawer.'
        ),
        renderer('status', {
          type: 'badge',
          variant: 'status',
          statusColor: 'green',
          status: 'Active',
        } as PageComponent),
        renderer(
          'array · multi-select',
          stack(
            [
              { type: 'badge', badgeVariant: 'secondary', children: [txt('EU')] } as PageComponent,
              {
                type: 'badge',
                badgeVariant: 'secondary',
                children: [txt('SaaS')],
              } as PageComponent,
              muted('+2'),
            ],
            'flex items-center gap-1'
          ),
          'Chips, with the overflow collapsed into a count rather than wrapped.'
        ),
        renderer(
          'formula',
          mono('= amount * 1.2'),
          'Read-only and mono, never editable in the grid — the value is derived and the inputs are elsewhere.'
        ),
        renderer('geolocation', mono('45.7640, 4.8357')),
        renderer('count', txt('12')),
        renderer(
          'json',
          mono('{ "status": "done", … }'),
          'A one-line preview, truncated. The drawer shows the pretty block.'
        ),
        renderer('code', mono('record.amount > 1000')),
        renderer('rating', txt('★★★☆☆')),
        renderer('progress', { type: 'progress', progressValue: 62 } as PageComponent),
        renderer('color', {
          type: 'swatch',
          token: 'primary',
          label: 'primary',
          size: 24,
        } as PageComponent),
        renderer('barcode', mono('| ||| | || |||')),
        renderer('duration', txt('2 h 45 m'), 'Hours and minutes, never a raw count of seconds.'),
        renderer('checkbox', { type: 'checkbox', checked: true } as PageComponent),
        renderer('single-attachment', {
          type: 'link',
          props: { href: '#', className: 'text-primary text-sm' },
          content: 'proposal.pdf',
        } as PageComponent),
        renderer(
          'multiple-attachments',
          stack(
            [
              {
                type: 'link',
                props: { href: '#', className: 'text-primary text-sm' },
                content: 'proposal.pdf',
              } as PageComponent,
              muted('+2'),
            ],
            'flex items-center gap-2'
          )
        ),
        renderer('datetime', txt('11 Sep 2026, 09:12')),
        renderer(
          'rich-text',
          txt('Agreed on a September pilot with two teams.'),
          'First line only, formatting stripped — a bold word in one row makes a column harder to scan, not easier.'
        ),
      ],
    },
    {
      id: 'editors',
      title: 'Cell editors',
      configKey: 'field widget → editor',
      drawings: [
        {
          label: 'multi-select popover',
          children: [
            panel([
              { type: 'checkbox', checked: true, props: { label: 'EU' } } as PageComponent,
              { type: 'checkbox', props: { label: 'SaaS' } } as PageComponent,
            ]),
          ],
        },
        {
          label: 'record picker',
          children: [
            panel([
              {
                type: 'input',
                props: { name: 'rp', placeholder: 'Search companies' },
              } as PageComponent,
              txt('Acme Europe'),
              txt('Acme Nordics'),
            ]),
          ],
        },
        {
          label: 'user picker',
          children: [
            panel([
              { type: 'avatar', initials: 'AL', label: 'Ada Lovelace' } as PageComponent,
              txt('Ada Lovelace'),
            ]),
          ],
        },
        {
          label: 'datetime',
          children: [
            panel([
              stack(
                [
                  {
                    type: 'date-picker',
                    dateFormat: 'DD/MM/YYYY',
                    props: { name: 'ce-d' },
                  } as PageComponent,
                  { type: 'time-picker', props: { name: 'ce-t' } } as PageComponent,
                ],
                'flex gap-2'
              ),
            ]),
          ],
        },
        {
          label: 'rich-text popover',
          children: [
            panel([
              {
                type: 'rich-text-editor',
                props: { name: 'ce-rt' },
                value: '<p>Agreed on a <strong>September</strong> pilot.</p>',
              } as PageComponent,
            ]),
          ],
        },
        {
          label: 'attachment editor',
          children: [
            panel([
              txt('proposal.pdf'),
              {
                type: 'button',
                variant: 'secondary',
                children: [btnLabel('Upload')],
              } as PageComponent,
            ]),
          ],
        },
        {
          label: 'legacy text popover',
          children: [
            panel([
              {
                type: 'input',
                props: { name: 'ce-legacy', value: 'record.amount > 1000' },
              } as PageComponent,
              { type: 'button', children: [btnLabel('Save')] } as PageComponent,
            ]),
          ],
        },
        {
          label: 'in-place checkbox',
          children: [cell([{ type: 'checkbox', checked: true } as PageComponent])],
        },
        { label: 'in-place rating', children: [cell([txt('★★★☆☆')])] },
      ],
    },
    {
      id: 'keyboard',
      title: 'Keyboard',
      configKey: 'table · the cell cursor',
      drawings: (
        [
          [
            'ArrowDown',
            'Moves one cell; the body scrolls only if the destination is out of view. At the last row it stays put rather than wrapping.',
          ],
          ['ArrowRight', 'Moves across columns, including the ones that cannot be edited.'],
          ['Home / End', 'First and last cell of the current row.'],
          [
            'PageUp / PageDown',
            'One viewport of rows, landing on a real row and never past the end.',
          ],
          ['Enter · F2', 'Opens the editor for the cell under the cursor.'],
          [
            'Enter · commit',
            'Writes, closes the editor, and drops one row — ready for the next value in the same column.',
          ],
          [
            'Escape',
            'Discards the draft and keeps the cursor on the cell. Focus never falls back to the document body.',
          ],
          [
            'Tab / Shift-Tab',
            'Commits and moves one EDITABLE cell right or left. Shift-Tab is the exact inverse.',
          ],
          [
            'Tab at the row end',
            'Wraps to the first editable cell of the next row, so a whole record can be typed without reaching for the mouse.',
          ],
          ['one tab stop', 'The grid is crossed in one keystroke from outside it.'],
          [
            'screen reader',
            'Announced as “Company, row 2 of 12, Acme Studio”. The roles do not wait on an aria-label being configured.',
          ],
        ] as const
      ).map(([k, _why]) => ({
        label: k,
        children: [cell([{ type: 'kbd', keys: k.split(' · ') } as PageComponent])],
      })),
    },
    {
      id: 'fill',
      title: 'Fill handle',
      configKey: 'table.fillHandle',
      drawings: [
        { label: 'resting', children: [cell([txt('Acme Europe'), muted('◢')])] },
        {
          label: 'drag down',
          children: [
            stack([
              cell([txt('Acme Europe')]),
              cell([muted('Acme Europe')], 'border-dashed'),
              cell([muted('Acme Europe')], 'border-dashed'),
            ]),
          ],
        },
        {
          label: 'released',
          children: [
            stack([
              cell([txt('Acme Europe'), muted('Saved')]),
              cell([txt('Acme Europe'), muted('Saved')]),
            ]),
          ],
        },
        {
          label: 'drag right',
          children: [stack([cell([txt('1240.50')]), cell([txt('€1,240.50')])], 'flex gap-2')],
        },
        { label: 'double-click the handle', children: [cell([txt('Acme Europe'), muted('◢◢')])] },
        {
          label: 'refused cell',
          children: [
            stack([
              cell([txt('€1,240.50')]),
              cell([muted('skipped — Starts is a date')], 'border-dashed'),
            ]),
          ],
        },
        { label: 'not editable', children: [cell([txt('= amount * 1.2')])] },
        {
          label: 'range selection',
          children: [
            stack([
              stack([cell([txt('Acme')]), cell([txt('EU')])], 'flex gap-2'),
              stack([cell([txt('Acme')]), cell([txt('EU')])], 'flex gap-2'),
            ]),
          ],
        },
      ],
    },
    {
      id: 'add-row',
      title: 'Add row',
      configKey: 'table.addRow',
      drawings: [
        {
          label: 'resting',
          children: [
            stack([cell([txt('Alan Turing')]), cell([muted('+ Add a row')], 'border-dashed')]),
          ],
        },
        { label: 'typing', children: [cell([txt('Nordwind')], 'border-dashed')] },
        {
          label: 'committed',
          children: [
            stack([
              cell([txt('Nordwind'), muted('Saved')]),
              cell([muted('+ Add a row')], 'border-dashed'),
            ]),
          ],
        },
        {
          label: 'required field missing',
          children: [
            stack([
              cell([txt('Nordwind')], 'border-dashed'),
              muted('Add a country before this row can be saved.'),
            ]),
          ],
        },
        {
          label: 'linked column',
          children: [
            panel([
              {
                type: 'input',
                props: { name: 'ar-link', placeholder: 'Search companies' },
              } as PageComponent,
              txt('Acme Europe'),
            ]),
          ],
        },
        { label: 'canCreate: false', children: [cell([txt('Alan Turing')])] },
        {
          label: 'a grouped table',
          children: [
            stack([
              muted('Active (2)'),
              cell([muted('+ Add a row — status: Active')], 'border-dashed'),
            ]),
          ],
        },
      ],
    },
  ],
}

export default table
