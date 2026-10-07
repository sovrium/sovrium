/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useState } from 'react'
import { resolveToolbarFlags } from './toolbar/toolbar-flags'
import type { TableContentProps } from './table-content'
import type { DisplayControlsProps } from './toolbar/display-controls'
import type { LeadingControlsProps } from './toolbar/leading-controls'
import type { QueryControlsProps } from './toolbar/query-controls'
import type { DataTableToolbarBarProps } from './toolbar/toolbar-bar'
import type { ToolbarFlags } from './toolbar/toolbar-flags'
import type {
  DataTableViewProps,
  GridBodyProps,
  StatusBannersProps,
  TableSurfaceProps,
  ViewDialogsProps,
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
  readonly flags: ToolbarFlags
  readonly isLoadingMore: boolean
  readonly onSearchPendingChange: (pending: boolean) => void
}

function deriveViewState(
  props: DataTableViewProps,
  searchPending: boolean,
  onSearchPendingChange: (pending: boolean) => void
): ViewDerived {
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
    flags: resolveToolbarFlags(props.toolbarConfig),
    // A continuation in flight, or a typed term still inside the debounce
    // window. See `searchPending` in `useViewProps`.
    isLoadingMore: props.isLoadingMore === true || searchPending,
    onSearchPendingChange,
  }
}

function buildLeadingProps(props: DataTableViewProps, derived: ViewDerived): LeadingControlsProps {
  return {
    canCreate: props.canCreate,
    newRecordLabel: props.newRecordLabel,
    onCreate: props.onCreate,
    showSearch: props.showSearch,
    searchConfig: props.searchConfig,
    globalFilter: props.globalFilter,
    setGlobalFilter: props.setGlobalFilter,
    onSearchPendingChange: derived.onSearchPendingChange,
    saveStatus: derived.toolbarSaveStatus,
  }
}

function buildQueryProps(props: DataTableViewProps, derived: ViewDerived): QueryControlsProps {
  return {
    // Import writes records, so it rides the create gate exactly as the
    // toolbar button and the add-row line do.
    canImport: props.canCreate && !derived.readOnly,
    onOpenImportDialog: props.ui.onOpenImportDialog,
    filtersEnabled: derived.flags.filters,
    onOpenFilterOverlay: props.ui.onOpenFilterOverlay,
    activeFilterCount: props.ui.activeFilters.length,
    sortEnabled: derived.flags.sort,
    onOpenSortOverlay: props.ui.onOpenSortOverlay,
    activeSortCount: props.ui.activeSorts.length,
  }
}

function buildDisplayProps(props: DataTableViewProps, derived: ViewDerived): DisplayControlsProps {
  return {
    table: props.table,
    tableName: props.tableName,
    canExportSelection: props.selectionConfig?.mode === 'multiple',
    selectedCount: props.selectedCount,
    exportEnabled: derived.flags.export,
    systemExportEndpoint: props.systemExportEndpoint,
    readOnly: derived.readOnly,
    activeFilter: props.ui.activeFilter,
    exportMenuOpen: props.ui.exportMenuOpen,
    onToggleExportMenu: props.ui.onToggleExportMenu,
    onCloseExportMenu: props.ui.onCloseExportMenu,
    refreshEnabled: derived.flags.refresh,
    onRefresh: props.onRefresh,
  }
}

function buildToolbarProps(
  props: DataTableViewProps,
  derived: ViewDerived
): DataTableToolbarBarProps {
  return {
    importDialogOpen: props.ui.importDialogOpen,
    leading: buildLeadingProps(props, derived),
    query: buildQueryProps(props, derived),
    display: buildDisplayProps(props, derived),
  }
}

function buildBannersProps(props: DataTableViewProps, derived: ViewDerived): StatusBannersProps {
  return {
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

function buildDialogsProps(props: DataTableViewProps, derived: ViewDerived): ViewDialogsProps {
  return {
    creating: props.creating,
    tableFields: derived.tableFields,
    fieldMeta: props.fieldMeta,
    newRecordLabel: props.newRecordLabel,
    saveLabel: props.saveLabel,
    cancelLabel: props.cancelLabel,
    onCancelCreate: props.onCancelCreate,
    onSubmitCreate: props.onSubmitCreate,
    tableName: props.tableName,
    ui: props.ui,
  }
}

function buildGridProps(props: DataTableViewProps, derived: ViewDerived): TableContentProps {
  return {
    table: props.table,
    ariaLabel: props.ariaLabel,
    useGridRole: !derived.readOnly,
    allColumns: props.allColumns,
    isLoading: props.isLoading,
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
    // The trailing add-row rides the toolbar button's own `canCreate` gate,
    // and a read-only system source has no records table to add to.
    canCreate: props.canCreate && !derived.readOnly,
    onRecordCreated: props.onRefresh,
  }
}

function buildBodyProps(props: DataTableViewProps, derived: ViewDerived): GridBodyProps {
  return {
    grid: buildGridProps(props, derived),
    phoneLayout: props.phoneLayout,
    table: props.table,
    totalRecords: props.totalRecords,
    paginationConfig: props.paginationConfig,
    cursorPaged: props.cursorPaged === true,
    hasMore: props.hasMore === true,
    isLoadingMore: derived.isLoadingMore,
    onLoadMore: props.onLoadMore,
  }
}

function buildSurfaceProps(props: DataTableViewProps, derived: ViewDerived): TableSurfaceProps {
  return {
    bulkActionsConfig: props.bulkActionsConfig,
    selectedCount: props.selectedCount,
    onBulkExecute: props.onBulkExecute,
    importDialogOpen: props.ui.importDialogOpen,
    filterOverlayOpen: props.ui.filterOverlayOpen,
    sortOverlayOpen: props.ui.sortOverlayOpen,
    panels: {
      tableFields: derived.tableFields,
      fieldMeta: props.fieldMeta,
      ui: props.ui,
    },
    body: buildBodyProps(props, derived),
  }
}

/**
 * Translate the island's flat prop surface into one bag per view region.
 *
 * The regions follow the DOM and the hooks that feed them follow the data, and
 * the two groupings do not coincide — `ui` reaches three regions at once, and
 * a third of the view's props pass through no hook at all. Rather than deform
 * either side, this module speaks both vocabularies and translates once.
 *
 * It also owns `searchPending`, the one piece of state the view holds. The
 * toolbar's search box raises it and the grid's continuation control reads it;
 * it belongs to neither, so it lives here. Pushing it into the toolbar would
 * leave the continuation acting on a view that is about to be replaced —
 * appending a page of unfiltered rows the landing term then discards.
 */
export function useViewProps(props: DataTableViewProps): ViewRegions {
  const [searchPending, setSearchPending] = useState(false)
  const derived = deriveViewState(props, searchPending, setSearchPending)

  return {
    banners: buildBannersProps(props, derived),
    toolbar: buildToolbarProps(props, derived),
    dialogs: buildDialogsProps(props, derived),
    surface: buildSurfaceProps(props, derived),
  }
}
