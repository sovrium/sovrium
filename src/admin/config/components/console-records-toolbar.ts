/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// sovrium-library: block/data-table-toolbar@0.38.0#449489a1bf03

// The toolbar above the Records grid.

// ── From pages/data/tables.ts (recordsToolbarCopy) ─────────────────────────────
/**
 * The toolbar above the grid, INSTALLED from the library's `data-table-toolbar`
 * block (shadcn's "tasks" toolbar row): the search box and the filter bar on
 * the left, Export CSV, Import CSV and New on the right. `Console Block Parity`
 * holds it to the block; re-install with
 * `sovrium library add block/data-table-toolbar --update`.
 *
 * NO facet: this page is written once for every table, and a facet names one
 * choice field that most tables do not have. The filter bar offers whatever
 * fields the table the address names declares.
 *
 * The bindings are the table (`$param.table`), the channel and the copy.
 *
 * Export CSV is drawn only once the table holds a record the reader may read:
 * the block's `hideExportWhenEmpty` wraps it in a box bound to the table's
 * first record, which draws it once per row — so an empty table, or a read
 * that fails, draws none and the page still renders.
 *
 * Import CSV opens the engine's import dialog for the table in the address.
 * The engine draws it only for a caller the table lets create records, so a
 * read-only operator never meets it.
 *
 * New opens the record drawer with no row, which is the drawer's create mode:
 * the same typed controls and refusals as editing a row. It is drawn only for
 * a caller who may make the console's operational writes, so a read-only
 * operator never meets a control the records API would refuse.
 */

import type { AppEncoded as AppConfig } from '@/domain/models/app'

type Template = NonNullable<AppConfig['components']>[number]

// eslint-disable-next-line sovrium/no-double-assertion -- a template that declares inputs writes `$name` where the component type expects a list or an object; each placement is decoded as the page component it produces when the app starts
export const consoleRecordsToolbar = {
  name: 'console-records-toolbar',
  type: 'container',
  render: 'transparent',
  element: 'div',
  props: {
    role: 'toolbar',
    'aria-label': '$t:admin.tables.toolbar',
    className: 'flex flex-wrap items-center gap-2',
  },
  children: [
    {
      type: 'search-input',
      placeholder: '$t:admin.tables.search',
      props: {
        'aria-label': '$t:admin.tables.search',
        className: 'h-8 w-full sm:w-[150px] lg:w-[250px]',
      },
      publishes: {
        bindTo: 'records-filter',
        param: 'q',
      },
    },
    {
      type: 'filter-bar',
      publishes: {
        bindTo: 'records-filter',
      },
      fieldsFrom: {
        table: '$param.table',
      },
    },
    {
      type: 'container',
      element: 'div',
      props: {
        className: 'flex items-center gap-2 sm:ml-auto',
      },
      children: [
        {
          type: 'container',
          element: 'div',
          props: {
            className: 'contents [&>li]:list-none',
          },
          dataSource: {
            table: '$param.table',
            limit: 1,
          },
          children: [
            {
              type: 'button',
              label: '$t:admin.tables.export',
              variant: 'outline',
              size: 'sm',
              action: {
                type: 'fetch',
                mode: 'download',
                url: '/api/tables/$param.table/export?format=csv',
                filename: '$param.table.csv',
              },
            },
          ],
        },
        {
          type: 'button',
          label: '$t:admin.tables.import',
          variant: 'outline',
          size: 'sm',
          action: {
            action: 'openImport',
            table: '$param.table',
          },
        },
        {
          type: 'button',
          label: '$t:admin.common.newRecord',
          variant: 'default',
          size: 'sm',
          action: {
            action: 'openSheet',
            component: 'record-detail-drawer',
          },
          visibility: {
            capability: 'edit-operations',
          },
        },
      ],
    },
  ],
} as unknown as Template
