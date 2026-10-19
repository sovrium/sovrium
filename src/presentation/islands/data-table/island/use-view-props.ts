/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { SelectionExportProps } from './selection-export'
import type { TableContentProps } from './table-content'
import type {
  DataTableViewProps,
  GridBodyProps,
  GridSelection,
  StatusBannersProps,
  TableSurfaceProps,
  ViewRegions,
} from './view-props'
import type { SaveStatus } from '../../hooks/use-inline-editing'

/**
 * The handful of values several regions need, computed once.
 *
 * `readOnly`, `cursorPaged`, `hasMore` and `isLoadingMore` used to carry
 * destructuring defaults on the view component; the view no longer unpacks its
 * props, so the defaults are applied here instead.
 */
interface ViewDerived {
  readonly indicatorStatus: SaveStatus
  readonly inlineSaveStatus: SaveStatus | undefined
  readonly toolbarSaveStatus: SaveStatus | undefined
  readonly showToastIndicator: boolean
  readonly tableFields: readonly string[]
  readonly readOnly: boolean
}

function deriveViewState(props: DataTableViewProps): ViewDerived {
  // Where the save-status indicator renders, or undefined when it is off.
  // Resolving the position once is what lets each of the three sites below be
  // a single comparison rather than a repeat of the "is it on at all" test.
  const position = props.saveIndicator?.show === true ? props.saveIndicator.position : undefined
  const indicatorStatus: SaveStatus = props.saveStatus ?? 'idle'

  return {
    indicatorStatus,
    inlineSaveStatus: position === 'inline' ? indicatorStatus : undefined,
    toolbarSaveStatus: position === 'toolbar' ? indicatorStatus : undefined,
    showToastIndicator: position === 'toast',
    tableFields: props.tableFields ?? [],
    readOnly: props.readOnly === true,
  }
}

function buildBannersProps(props: DataTableViewProps, derived: ViewDerived): StatusBannersProps {
  return {
    ...(derived.toolbarSaveStatus !== undefined && {
      toolbarSaveStatus: derived.toolbarSaveStatus,
    }),
    showToastIndicator: derived.showToastIndicator,
    indicatorStatus: derived.indicatorStatus,
    saveError: props.saveError,
    onRetrySave: props.onRetrySave,
    saveConflict: props.saveConflict,
    conflict: props.conflict,
    onDismissConflict: props.onDismissConflict,
    connectionStatus: props.connectionStatus,
  }
}

function buildGridProps(props: DataTableViewProps, derived: ViewDerived): TableContentProps {
  return {
    table: props.table,
    ariaLabel: props.ariaLabel,
    useGridRole: !derived.readOnly,
    allColumns: props.allColumns,
    isLoading: props.isLoading,
    loadingMore: props.isLoadingMore === true,
    striped: props.striped,
    rowColorField: props.rowColorField,
    rowColorFieldColors: props.rowColorFieldColors,
    currentRowHeight: props.currentRowHeight,
    layout: props.layout,
    cellClass: props.cellClass,
    borderClass: props.borderClass,
    emptyMessage: props.emptyMessage,
    noMatchMessage: props.noMatchMessage,
    globalFilter: props.globalFilter,
    selectionMode: props.selectionConfig?.mode,
    groupByConfig: props.groupByConfig,
    groupCounts: props.groupCounts,
    groupAggregations: props.groupAggregations,
    summaryConfig: props.summaryConfig,
    summaryAggregations: props.summaryAggregations,
    columnConfig: props.columnConfig,
    editingCell: props.editingCell,
    fieldMeta: props.fieldMeta,
    tableName: props.tableName,
    autoSave: props.autoSave,
    inlineSaveStatus: derived.inlineSaveStatus,
    onRowClickAction: props.onRowClickAction,
    onCellDoubleClick: props.onCellDoubleClick,
    onEditSave: props.onEditSave,
    onEditCancel: props.onEditCancel,
    onCellCommit: props.onCellCommit,
    collapsedGroups: props.ui.collapsedGroups,
    onToggleGroupCollapsed: props.ui.toggleGroupCollapsed,
    // The trailing add-row rides the server's `canCreate` gate, and a
    // read-only system source has no records table to add to.
    canCreate: props.canCreate && !derived.readOnly,
    onRecordCreated: props.onRefresh,
  }
}

function buildBodyProps(props: DataTableViewProps, derived: ViewDerived): GridBodyProps {
  const selection = buildSelection(props, derived)
  return {
    ...(selection !== undefined && { selection }),
    session: {
      table: props.table,
      ...(props.fieldMeta !== undefined && { fieldMeta: props.fieldMeta }),
      ...(props.groupByConfig !== undefined && { groupedBy: props.groupByConfig.field }),
      onGroup: props.ui.setGrouping,
      rowHeight: props.currentRowHeight,
      onRowHeight: props.ui.setRowHeight,
    },
    grid: buildGridProps(props, derived),
    phoneLayout: props.phoneLayout,
    table: props.table,
    totalRecords: props.totalRecords,
    unanswered: props.isLoading || props.unanswered === true,
    paginationConfig: props.paginationConfig,
    cursorPaged: props.cursorPaged === true,
    hasMore: props.hasMore === true,
    isLoadingMore: props.isLoadingMore === true,
    onLoadMore: props.onLoadMore,
  }
}

/**
 * The selection export of a multi-select grid. Not offered on a view-bound
 * grid: the export route is the table's, gated on a read grant a visitor on a
 * public view does not hold.
 */
function buildSelectionExport(props: DataTableViewProps): SelectionExportProps | undefined {
  if (props.selectionConfig?.mode !== 'multiple' || props.isViewBound) return undefined
  return {
    table: props.table,
    tableName: props.tableName,
    ...(props.systemExportEndpoint !== undefined && {
      systemExportEndpoint: props.systemExportEndpoint,
    }),
  }
}

/**
 * What the bottom bar offers for the checked rows, on a grid whose rows can be
 * checked. Delete is offered on a table the reader may delete from, never on a
 * read-only system source or a view-bound grid, whose rows are not the table's
 * to delete through this grid.
 */
function buildSelection(
  props: DataTableViewProps,
  derived: ViewDerived
): GridSelection | undefined {
  if (props.selectionConfig?.mode === undefined) return undefined
  const selectionExport = buildSelectionExport(props)
  const deletes =
    props.canDelete && !derived.readOnly && !props.isViewBound && props.tableName !== ''
  return {
    bulkActions: props.bulkActionsConfig ?? [],
    selectedCount: props.selectedCount,
    onExecute: props.onBulkExecute,
    ...(selectionExport !== undefined && { selectionExport }),
    ...(deletes && { deleteFrom: props.tableName }),
  }
}

function buildSurfaceProps(props: DataTableViewProps, derived: ViewDerived): TableSurfaceProps {
  return {
    bulkActionsConfig: props.bulkActionsConfig,
    body: buildBodyProps(props, derived),
  }
}

/**
 * Translate the island's flat prop surface into one bag per view region.
 *
 * The regions follow the DOM and the hooks that feed them follow the data, and
 * the two groupings do not coincide — a third of the view's props pass
 * through no hook at all. Rather than deform either side, this module speaks
 * both vocabularies and translates once.
 */
export function useViewProps(props: DataTableViewProps): ViewRegions {
  const derived = deriveViewState(props)

  return {
    banners: buildBannersProps(props, derived),
    surface: buildSurfaceProps(props, derived),
  }
}
