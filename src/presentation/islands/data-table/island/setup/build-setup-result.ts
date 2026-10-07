/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { ROW_HEIGHT_CLASSES } from '../../../hooks/use-data-table-state'
import { resolveSearchConfig, shouldShowSearch } from '../island-setup-helpers'
import type { SetupContext } from './setup-params'
import type { EffectiveLayout } from './use-effective-layout'
import type { EffectiveQuery } from './use-effective-query'
import type { GridActions } from './use-grid-actions'
import type { GridInstance, GridRecords } from './use-grid-table'
import type { InlineSaveWiring } from './use-inline-save-wiring'
import type { RecordsQuery } from './use-records-query'
import type { RefreshWiring } from './use-refresh-wiring'
import type { useInlineEditing } from '../../../hooks/use-inline-editing'
import type { DataTableColumnDef } from '../table-features'

export interface SetupResultInput {
  readonly ctx: SetupContext
  readonly layout: EffectiveLayout
  readonly effective: EffectiveQuery
  readonly records: RecordsQuery
  readonly refresh: RefreshWiring
  readonly gridRecords: GridRecords
  readonly allColumns: readonly DataTableColumnDef[]
  readonly grid: GridInstance
  readonly actions: GridActions
  readonly inlineEditing: ReturnType<typeof useInlineEditing>
  readonly inlineSave: InlineSaveWiring
}

/**
 * Flatten the setup sub-hooks into the single bag the island hands to its view.
 *
 * Kept out of `useDataTableIslandSetup` so that hook reads as what it is — an
 * ordered sequence of hook calls — rather than being buried under the shape of
 * its own return value.
 */
export function buildIslandSetupResult(input: SetupResultInput) {
  const { ctx, layout, records, refresh, gridRecords, grid } = input
  const { query } = records
  const { tableState } = layout

  return {
    ui: ctx.ui,
    table: grid.table,
    records: gridRecords.rows,
    allColumns: input.allColumns,
    totalRecords: gridRecords.totalRecords,
    /**
     * Cursor-feed state: whether the pager must yield to a continuation,
     * whether more rows follow, and the action that fetches them.
     */
    cursorFeed: gridRecords.cursorFeed,
    /**
     * Whole-view aggregates for the summary footer, computed server-side over
     * the filtered table. Undefined until the first records response lands (and
     * always, for a system source, which has no aggregate endpoint).
     */
    summaryAggregations: query.data?.aggregations,
    /**
     * Whole-view record count per group value. Undefined until the first grouped
     * response lands (and always for a system source, which has no records API
     * to ask), in which case each header counts its loaded rows instead.
     */
    groupCounts: query.groupCounts,
    /**
     * Whole-view aggregations per group value — the declared `summary` answered
     * for each group. Present only when the grid both groups and summarises.
     */
    groupAggregations: query.groupAggregations,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    // The last read failure the operator has not yet acted on. Distinct from
    // `isError` deliberately: a refused sort is reverted, which returns the
    // query to its previous cached key and clears `isError` within a frame, so
    // a banner keyed on the live status would flash past unread.
    readError: refresh.sortRefusal.readError,
    inlineEditing: input.inlineEditing,
    inlineAutoSave: input.inlineSave.inlineAutoSave,
    saveIndicator: input.inlineSave.saveIndicator,
    handleRefresh: refresh.handleRefresh,
    onBulkExecute: input.actions.onBulkExecute,
    conflict: grid.conflict,
    dismissConflict: grid.dismissConflict,
    connectionStatus: refresh.connectionStatus,
    globalFilter: tableState.globalFilter,
    setGlobalFilter: tableState.setGlobalFilter,
    rowSelection: tableState.rowSelection,
    currentRowHeight: tableState.currentRowHeight,
    cellClass: ROW_HEIGHT_CLASSES[tableState.currentRowHeight],
    borderClass: ctx.params.bordered ? 'border border-border' : '',
    showSearch: shouldShowSearch(ctx.params.searchConfig, ctx.params.toolbarConfig),
    /**
     * Search settings the toolbar renders from — the author's `search` block, or
     * the defaults a bare `toolbar: { search: true }` implies. See
     * `resolveSearchConfig`: the render gate used to require the block itself,
     * so the toolbar flag alone painted nothing.
     */
    resolvedSearchConfig: resolveSearchConfig(ctx.params.searchConfig, ctx.params.toolbarConfig),
    /** The bound view's grouping, the only one a grid draws. */
    effectiveGroupByConfig: records.effectiveGroupByConfig,
  }
}
