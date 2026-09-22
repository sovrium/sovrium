/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useMemo } from 'react'
import { useRealtimeReconciliation } from '../../../hooks/use-realtime-reconciliation'
import { useCursorFeedView } from '../../../hooks/use-system-cursor-pages'
import { buildColumns } from '../columns'
import {
  applyClientFilters,
  resolveClientSorted,
  useColumnSizingPersistence,
} from '../island-setup-helpers'
import { createRowActionHandler } from '../row-actions'
import { useDataTableInstance } from '../use-table'
import type { SetupContext } from './setup-params'
import type { EffectiveLayout } from './use-effective-layout'
import type { EffectiveQuery } from './use-effective-query'
import type { RecordsQuery } from './use-records-query'
import type { RefreshWiring } from './use-refresh-wiring'
import type { useInlineEditing } from '../../../hooks/use-inline-editing'
import type { DataTableColumnDef } from '../table-features'

export type GridRecords = ReturnType<typeof useGridRecords>
export type GridInstance = ReturnType<typeof useGridInstance>

/**
 * The rows on screen: every page the operator has asked for, narrowed by the
 * runtime filter-builder.
 *
 * The server returns the unfiltered page — the filter-builder is purely client
 * state, so narrowing happens here, before the records reach TanStack Table.
 */
export function useGridRecords(ctx: SetupContext, records: RecordsQuery) {
  const cursorFeed = useCursorFeedView(
    records.cursorPages,
    records.query.data,
    records.query.isPlaceholderData
  )
  const { activeFilters } = ctx.ui
  const { filterConjunction } = ctx.ui
  // `fieldMeta` decides how an `equals` predicate compares — numerically on a
  // number column, as a string everywhere else. Without it a filter saved on a
  // text column coerces its value to `NaN` and matches nothing.
  const { fieldMeta } = ctx.params
  // `cursorFeed.records` is already memoized, and v9's `data` option takes a
  // `ReadonlyArray` — so the defensive readonly -> mutable copy v8 forced here
  // is gone.
  const rows = useMemo(
    () => applyClientFilters(cursorFeed.records, activeFilters, filterConjunction, fieldMeta),
    [cursorFeed.records, activeFilters, filterConjunction, fieldMeta]
  )

  return { cursorFeed, rows, totalRecords: cursorFeed.total }
}

/**
 * The column definitions.
 *
 * A plain builder rather than a hook, called between two hooks only because
 * that is where it sat before: it reads the rows and produces the columns that
 * describe them.
 */
export function buildGridColumns(
  ctx: SetupContext,
  layout: EffectiveLayout,
  grid: GridRecords,
  refresh: RefreshWiring
): readonly DataTableColumnDef[] {
  const { params, queryClient, tableKey } = ctx
  const executeRowAction = createRowActionHandler({
    queryClient,
    queryKey: refresh.queryKey,
  })

  return buildColumns({
    columnConfig: params.columnConfig,
    records: grid.rows,
    selectionConfig: params.selectionConfig,
    tableFields: params.tableFields,
    saveLabel: params.saveLabel,
    cancelLabel: params.cancelLabel,
    onActionClick: executeRowAction,
    fieldMeta: params.fieldMeta,
    showRowNumbers: params.showRowNumbers === true,
    // Row numbers count through the VIEW, not the page: a per-page 1..N would
    // make two different rows both "row 1", which is the one thing a row number
    // exists to prevent. The grid pages server-side, so the page's own row
    // index has to be offset by the rows that came before it.
    rowNumberOffset: layout.tableState.pagination.pageIndex * layout.tableState.pagination.pageSize,
    // Realtime data tables are inline-editable by default so an optimistic
    // edit can be made and then reconciled against incoming server state.
    autoColumnsEditable: params.dataSource.refreshMode === 'realtime',
    // Empty for a system-backed source, which has no record route to invoke —
    // a button cell there stays inert rather than addressing a bad URL.
    tableName: tableKey,
    // A button's automation commonly writes back to the record it was pressed
    // on. The grid is the only surface a button field renders on that holds a
    // query cache, so it is the one that supplies the re-read.
    onButtonInvoked: refresh.handleRefresh,
  })
}

interface GridInstanceInput {
  readonly allColumns: readonly DataTableColumnDef[]
  readonly effective: EffectiveQuery
  readonly records: RecordsQuery
  readonly inlineEditing: ReturnType<typeof useInlineEditing>
  readonly sortRefusal: RefreshWiring['sortRefusal']
}

/**
 * The TanStack Table instance, the realtime reconciliation that guards it, and
 * the column-width persistence that outlives it.
 */
export function useGridInstance(
  ctx: SetupContext,
  layout: EffectiveLayout,
  grid: GridRecords,
  input: GridInstanceInput
) {
  const { tableState } = layout

  // Realtime mode: detect when an incoming server snapshot overwrites a field
  // the user could already see, and surface a conflict toast (server-wins).
  // A detected conflict also closes any open inline editor — its optimistic
  // value is stale, so the cell must render the authoritative server state.
  const { conflict, dismissConflict } = useRealtimeReconciliation({
    enabled: ctx.params.dataSource.refreshMode === 'realtime',
    records: grid.rows,
    onConflict: input.inlineEditing.cancelEditing,
  })

  const table = useDataTableInstance({
    records: grid.rows,
    allColumns: input.allColumns,
    sorting: input.effective.sorting,
    // Not the raw setter: every header click goes through the refusal guard, so
    // a sort the server declines can be taken back off the header it is drawn on.
    setSorting: input.sortRefusal.onSortingChange,
    columnFilters: tableState.columnFilters,
    setColumnFilters: tableState.setColumnFilters,
    globalFilter: tableState.globalFilter,
    setGlobalFilter: tableState.setGlobalFilter,
    pagination: tableState.pagination,
    setPagination: tableState.setPagination,
    rowSelection: tableState.rowSelection,
    setRowSelection: tableState.setRowSelection,
    columnVisibility: ctx.ui.columnVisibility,
    setColumnVisibility: ctx.ui.setColumnVisibility,
    columnOrder: ctx.ui.columnOrder,
    setColumnOrder: ctx.ui.setColumnOrder,
    columnSizing: tableState.columnSizing,
    setColumnSizing: tableState.setColumnSizing,
    selectionConfig: ctx.params.selectionConfig,
    totalRecords: grid.totalRecords,
    // The response's OWN declaration that it already applied the term. Absent
    // (`undefined`) on every endpoint that does not search — the system
    // endpoints not yet migrated, and the DB-table TRASH branch, which ignores
    // `?q=` outright — so those grids keep narrowing the page in memory exactly
    // as before. The DB-table LIST branch DOES declare it (`null` when no term
    // was supplied), which is what stops it re-filtering a page the server has
    // already filtered.
    serverFiltered: input.records.query.data?.appliedQuery !== undefined,
    // The rows COUNTED here are the ones the feed has accumulated, not the ones
    // the filter-builder left on screen — see `resolveClientSorted`.
    clientSorted: resolveClientSorted(
      Boolean(ctx.params.dataSource.system),
      grid.cursorFeed.records.length,
      grid.totalRecords
    ),
  })

  // Column-width persistence is preferences-backed (DB-table-only). For a
  // system source `tableKey` is empty and `updatePreferences` no-ops, but the
  // effect's localStorage write is also keyed on `tableKey`, so passing the
  // empty key keeps the persistence inert.
  useColumnSizingPersistence(ctx.tableKey, tableState.columnSizing, layout.prefs.updatePreferences)

  return { table, conflict, dismissConflict }
}
