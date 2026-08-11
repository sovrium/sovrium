/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Data-tab **Records** page ([internal ref], re-
 * targeted from the per-object Data tab to the global Data tab).
 *
 * Pass 1 items 1.5a + 1.5c removed the duplicate in-pane table picker rail: the
 * authoritative table list is the sidebar's auto-expanded Records
 * disclosure. So a bare `/_admin/tables` (app with ≥1 table)
 * 302-REDIRECTS to the FIRST declared table's grid (`/_admin/tables/{first}`),
 * and the selected table mounts the EXISTING `admin-record-grid` island
 * (server-side search / sort / filter / create / delete / trash) over the records
 * CRUD API, plus the EXISTING `record-drawer` (schema-derived per-record form)
 * opened on a row click — FULL-WIDTH, no left rail. No new backend, no new island.
 *
 * Selection is a path segment, so it is URL-derived (back/forward + SPA swap +
 * sidebar highlight compose for free). An app with no tables shows an honest
 * whole-page empty state (no redirect).
 */

import { parseDataRoute } from '../dashboard-surface-routes'
import {
  dataObjectFullWidth,
  dataPageEmptyState,
  dataPageIntro,
  firstObjectRedirect,
  objectScopedPage,
  type DataObjectRedirect,
} from './data-object-rail'
import { extractFields, recordGridDataTable, type TableField } from './table-data-surface'
import type { DataShellOptions } from './data-landing-surface'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * Drawer component id the record grid opens on a row click. The generic
 * {@link recordGridDataTable} sets `onRowClick: { action: 'openDrawer', component:
 * 'record-detail-drawer' }`, so this surface's `record-drawer` MUST carry the
 * same id for the row-click → `sovrium:open-drawer` dispatch to find it.
 */
const RECORD_DRAWER_ID = 'record-detail-drawer'

/** An operator table (the grid's field source + the redirect's first-object source). */
type OperatorTable = App['tables'] extends ReadonlyArray<infer T> | undefined ? T : never

/** The declared table names, in declaration order (the first is the redirect target). */
function tableNames(tables: ReadonlyArray<OperatorTable>): ReadonlyArray<string> {
  return tables.flatMap((table): ReadonlyArray<string> => {
    const { name } = table as { readonly name?: unknown }
    return typeof name === 'string' ? [name] : []
  })
}

/** The page intro: heading + orienting one-liner. */
function intro(): Component {
  return dataPageIntro(
    'Records',
    'Browse and edit the records in your tables. Choose a table to open its grid — search, sort, filter, then open a record to edit it.'
  )
}

/**
 * The selected table's record-grid + drawer body (reuses the per-table Data
 * building blocks). The grid is the GENERIC `data-table` bound to the operator
 * table (list / create / inline-edit over the records CRUD API, server-side
 * search); a row click fires `onRowClick: openDrawer`, opening the schema-derived
 * `record-drawer`.
 */
function tableGridBody(
  tableName: string,
  fields: ReadonlyArray<TableField>,
  canEdit: boolean
): Component {
  return {
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-4' },
    children: [
      recordGridDataTable(tableName, fields),
      {
        type: 'record-drawer',
        id: RECORD_DRAWER_ID,
        props: { title: 'Record details' },
        dataSource: { table: tableName },
        recordFields: fields.map((field) => ({ name: field.name, type: field.type })),
        canEdit,
      },
    ],
  } as unknown as Component
}

/** The whole-page empty state when the operator declares no tables. */
function noTablesBody(): Component {
  return dataPageEmptyState(
    'No tables',
    'This app declares no tables yet. Add one in your app config to start capturing records.',
    'Add a table first — records follow.'
  )
}

/**
 * The page body for the selected table: its record grid mounted FULL-WIDTH (Pass
 * 1 item 1.5c). Falls back to the whole-page empty state when the slug matches no
 * declared table (defensive — the redirect normally lands on a real table).
 */
function tablesBody(
  selected: string,
  selectedTable: OperatorTable | undefined,
  canEdit: boolean
): Component {
  if (selectedTable === undefined) return noTablesBody()
  return dataObjectFullWidth(tableGridBody(selected, extractFields(selectedTable), canEdit))
}

/** Assemble the Records `Page` (id / path / meta / shell) around a body. */
function tablesPage(
  selected: string | undefined,
  body: Component,
  options: DataShellOptions
): Page {
  return objectScopedPage(
    { key: 'tables', label: 'Records', intro: intro() },
    selected,
    body,
    options
  )
}

/**
 * Build the Records page — or a 302 redirect to the first table.
 *
 * A bare `/_admin/tables` with ≥1 declared table returns a {@link DataObjectRedirect}
 * to the first table's grid (Pass 1 item 1.5a). With a `selected` table the body
 * mounts the record grid scoped to it FULL-WIDTH (no rail). An app with no tables
 * shows the whole-page empty state (no redirect).
 */
export function buildDataTablesPage(
  operatorApp: App,
  selected: string | undefined,
  options: DataShellOptions
): Page | DataObjectRedirect {
  const tables = (operatorApp.tables ?? []) as ReadonlyArray<OperatorTable>
  const names = tableNames(tables)

  // Bare object-page path with ≥1 table → 302-redirect to the first table's grid.
  if (selected === undefined && names[0] !== undefined) {
    return firstObjectRedirect('tables', names[0])
  }

  const selectedTable = selected
    ? tables.find((t) => (t as { name?: string }).name === selected)
    : undefined
  const body = selected ? tablesBody(selected, selectedTable, options.canEdit) : noTablesBody()

  return tablesPage(selected, body, options)
}

/**
 * The operator table(s) a synthesized surface must carry so its record-grid
 * resolves real columns. Covers the Records grid (`/tables/:name`),
 * which mounts the record-grid island. Returns an empty array for paths with no
 * per-table grid. ([internal ref] retired the `/data` segment, so the grid path is the
 * top-level `/tables/:name`, parsed by {@link parseDataRoute} as
 * `{ page: 'tables', object: name }`.)
 */
export function recordGridTablesFor(
  operatorApp: App,
  dashboardPath: string
): NonNullable<App['tables']> {
  const dataRoute = parseDataRoute(dashboardPath)
  const selectedTableName = dataRoute?.page === 'tables' ? dataRoute.object : undefined
  const table = selectedTableName
    ? (operatorApp.tables ?? []).find((t) => t.name === selectedTableName)
    : undefined
  return table ? [table] : []
}
