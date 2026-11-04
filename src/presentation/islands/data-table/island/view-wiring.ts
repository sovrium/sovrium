/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { gridPagination, pagerPagination } from './setup/row-cap'
import { effectiveSelection } from './setup/use-grid-table'
import type { DataTableIslandProps } from './island-props'
import type { readFailureWiring } from './read-failure-wiring'
import type { useDataTableIslandSetup } from './use-island-setup'
import type { DataTableViewProps } from './view-props'
import type { DataTableRowClickAction } from '../data-row-types'

/**
 * The data-table island's VIEW wiring: how its props, its setup and its read
 * failure become the one prop bag its view takes. The island only coordinates
 * hooks; every default and every "present only when" lives here, in functions
 * small enough to read one decision at a time.
 */

type IslandSetup = ReturnType<typeof useDataTableIslandSetup>
type ReadFailure = ReturnType<typeof readFailureWiring>

/** What the view wiring reads, besides the island's props and setup. */
export interface ViewWiringInput {
  readonly props: DataTableIslandProps
  readonly setup: IslandSetup
  readonly failure: ReadFailure
  readonly readOnly: boolean
  readonly searching: boolean
  readonly containerRef: React.Ref<HTMLDivElement>
  readonly onRowClickAction: DataTableRowClickAction | undefined
}

/**
 * The empty state's words. A read that failed before any row arrived has
 * nothing to say about the data: "No records" under "Couldn’t load records."
 * would be a claim the grid never asked the server. So neither the empty state
 * nor the pager's "No results" is drawn under a failure; a refused RE-read
 * keeps both, over the rows it is still showing.
 */
function emptyMessageOf(input: ViewWiringInput): string {
  const { props, failure, searching } = input
  if (failure.failedEmpty) return ''
  const noRecords = props.uiStrings?.['datatable.noRecords'] ?? 'No records found'
  return props.emptyMessage ?? (searching ? undefined : props.tableEmptyMessage) ?? noRecords
}

/** The props the view takes only when they are present. */
function optionalViewProps({ props, setup }: ViewWiringInput) {
  return {
    ...(props.ariaLabel && { ariaLabel: props.ariaLabel }),
    // A system source's selection export serialises the rows it holds (there
    // is no DB table to route a selection through). Present only for a
    // `dataSource.system` binding.
    ...(props.dataSource.system?.endpoint && {
      systemExportEndpoint: props.dataSource.system.endpoint,
    }),
    ...(setup.groupCounts && { groupCounts: setup.groupCounts }),
    ...(setup.groupAggregations && { groupAggregations: setup.groupAggregations }),
    ...(props.noMatchMessage !== undefined && { noMatchMessage: props.noMatchMessage }),
  }
}

/** Where the rows come from and how many there are: source, paging, grouping, summary. */
function readViewProps({ props, setup, failure }: ViewWiringInput) {
  const channel = props.dataSource.bindTo ?? props.dataSource.system?.bindTo
  return {
    table: setup.table,
    viewChannel: channel,
    subscribed: channel !== undefined,
    tableName: props.dataSource.table ?? '',
    allColumns: setup.allColumns,
    totalRecords: failure.totalRecords,
    isLoading: setup.isLoading,
    unanswered: failure.unanswered,
    paginationConfig: failure.failedEmpty
      ? undefined
      : pagerPagination(gridPagination(props.pagination, props.dataSource), props.dataSource.limit),
    cursorPaged: setup.cursorFeed.cursorPaged,
    hasMore: setup.cursorFeed.hasMore,
    isLoadingMore: setup.cursorFeed.isLoadingMore,
    onLoadMore: setup.cursorFeed.onLoadMore,
    groupByConfig: setup.effectiveGroupByConfig,
    summaryAggregations: setup.summaryAggregations,
    globalFilter: setup.searchQuery,
    narrowed: setup.narrowed,
    connectionStatus: setup.connectionStatus,
    ui: setup.ui,
  }
}

/** How the rows are drawn: the author's layout, columns, colours and heights. */
function drawViewProps({ props, setup }: ViewWiringInput) {
  return {
    layout: props.layout,
    embedded: props.embedded === true,
    phoneLayout: props.phoneLayout,
    viewOptions: props.viewOptions,
    selectionConfig: effectiveSelection({
      selectionConfig: props.selection,
      publishesSelection: props.publishes !== undefined,
    }),
    bulkActionsConfig: props.bulkActions,
    summaryConfig: props.summary,
    columnConfig: props.columns,
    tableFields: props.tableFields,
    fieldMeta: props.fieldMeta,
    striped: props.striped ?? false,
    rowColorField: props.rowColorField,
    rowColorFieldColors: props.rowColorFieldColors,
    currentRowHeight: setup.currentRowHeight,
    rowHeightDeclared: props.rowHeight !== undefined,
    inlineExpand: props.rowExpandInline,
    cellClass: setup.cellClass,
    borderClass: setup.borderClass,
  }
}

/**
 * What the reader may do to the rows. A system source is read-only: never
 * offer the trailing add-row (there is no records table to write to).
 * Otherwise it is offered unless the server explicitly denied create for the
 * role.
 */
function writeViewProps({ props, setup, readOnly, onRowClickAction }: ViewWiringInput) {
  const editing = setup.inlineEditing
  return {
    readOnly,
    canCreate: !readOnly && props.canCreate !== false,
    canDelete: !readOnly && props.canDelete !== false,
    isViewBound: props.isViewBound === true,
    selectedCount: Object.keys(setup.rowSelection).length,
    editingCell: editing.editingCell,
    autoSave: setup.inlineAutoSave,
    saveError: editing.saveError,
    saveConflict: editing.saveConflict,
    onRetrySave: () => void editing.retryFailedSave(),
    saveStatus: editing.saveStatus,
    saveIndicator: setup.saveIndicator,
    onRowClickAction,
    onCellDoubleClick: editing.startEditing,
    onEditSave: editing.saveEdit,
    onEditCancel: editing.cancelEditing,
    onCellCommit: editing.commitCellValue,
    onRefresh: setup.handleRefresh,
    onBulkExecute: setup.onBulkExecute,
    conflict: setup.conflict,
    onDismissConflict: setup.dismissConflict,
  }
}

/** The whole prop bag the island hands its view. */
export function toDataTableViewProps(input: ViewWiringInput): DataTableViewProps {
  return {
    containerRef: input.containerRef,
    ...optionalViewProps(input),
    ...readViewProps(input),
    ...drawViewProps(input),
    ...writeViewProps(input),
    emptyMessage: emptyMessageOf(input),
  }
}
