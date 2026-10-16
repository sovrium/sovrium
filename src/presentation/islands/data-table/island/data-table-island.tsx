/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { AccountSessionsContext, isAccountSessionsEndpoint } from '../account-sessions'
import { usePasteImport } from '../paste-preview/use-paste-import'
import { ViewSwitcher } from '../view-options/view-switcher'
import {
  isReadOnlyBinding,
  resolveRowClickAction,
  toPasteParams,
  toSetupParams,
  useColumnDisplayFieldMeta,
} from './entry-wiring'
import { GridStringsContext, type GridStrings } from './grid-strings'
import { usePhoneRowOpen } from './phone-row-open'
import { ReadErrorNotice } from './read-error-notice'
import { pagerPagination } from './setup/row-cap'
import { effectiveSelection } from './setup/use-grid-table'
import { useClipboardCopy } from './use-clipboard-copy'
import { useDataTableIslandSetup } from './use-island-setup'
import { usePublishedSelection } from './use-published-selection'
import { DataTableView } from './view/data-table-view'
import type { DataTableIslandProps } from './island-props'

/** The provider value of a grid whose host sent no strings: every control keeps its English. */
const NO_UI_STRINGS: GridStrings = {}

/**
 * The label a refused sort's column is named by: the declared column label,
 * else the field's own label, else its name.
 */
function columnLabelOf(props: DataTableIslandProps, id: string | undefined): string | undefined {
  if (id === undefined) return undefined
  const declared = props.columns?.find((column) => 'field' in column && column.field === id)
  const label = declared !== undefined && 'label' in declared ? declared.label : undefined
  return label ?? props.fieldMeta?.[id]?.label ?? id
}

// eslint-disable-next-line max-lines-per-function, complexity -- thin coordinator: 60+ lines of prop-forwarding wiring whose ?? / && short-circuit defaults aggregate one past the threshold; further extraction would obscure the call site
export default function DataTableIsland(islandProps: DataTableIslandProps) {
  // On a phone a row opens like its Open action, and the action column is dropped.
  const props = usePhoneRowOpen(useColumnDisplayFieldMeta(islandProps))
  const isReadOnly = isReadOnlyBinding(props)
  const setup = useDataTableIslandSetup(toSetupParams(props))
  // Clipboard + paste-import: cell/row selection + Ctrl/Cmd+C / +V handlers.
  // Paste-import (CSV-via-clipboard) targets a DB table; for a system source
  // there is no records table to write to, so it is gated OFF.
  const clipboardRef = useClipboardCopy()
  const paste = usePasteImport(toPasteParams(props, clipboardRef, setup.handleRefresh, isReadOnly))
  const onRowClickAction = resolveRowClickAction(props.onRowClick)
  usePublishedSelection(props.publishes, setup.table, setup.rowSelection)

  // A system source is read-only: never offer the trailing add-row (there is
  // no records table to write to). Otherwise it is offered unless the server
  // explicitly denied create for the role.
  const showCreate = !isReadOnly && props.canCreate !== false
  // Optional props applied only when present (keeps the JSX spread free of inline
  // boolean operators that would inflate this component's cyclomatic complexity).
  const optionalProps = {
    ...(props.ariaLabel && { ariaLabel: props.ariaLabel }),
    // A system source's selection export serialises the rows it holds (there
    // is no DB table to route a selection through). Present only for a
    // `dataSource.system` binding.
    ...(props.dataSource.system?.endpoint && {
      systemExportEndpoint: props.dataSource.system.endpoint,
    }),
  }
  // Pre-resolve the remaining short-circuit defaults out of the JSX so they
  // don't count toward this component's cyclomatic complexity.
  const tableName = props.dataSource.table ?? ''
  const striped = props.striped ?? false
  // A read that failed before any row arrived has nothing to say about the
  // data: "No records" under "Couldn’t load records." would be a claim the
  // grid never asked the server. So neither the empty state nor the pager's
  // "No results" is drawn under a failure; a refused RE-read keeps both, over
  // the rows it is still showing.
  const failedEmpty = setup.readError !== undefined && setup.table.getRowModel().rows.length === 0
  const noRecords = props.uiStrings?.['datatable.noRecords'] ?? 'No records found'
  const searching = setup.searchQuery.trim() !== ''
  const emptyMessage = failedEmpty
    ? ''
    : (props.emptyMessage ?? (searching ? undefined : props.tableEmptyMessage) ?? noRecords)
  // A grid of the reader's own sessions marks each row current or not.
  const sessionsList = isAccountSessionsEndpoint(props.dataSource.system?.endpoint)

  return (
    <GridStringsContext.Provider value={props.uiStrings ?? NO_UI_STRINGS}>
      {paste.dialog}
      {paste.toast}
      {/*
        A failed read is TOLD, not enacted. This used to `return <ErrorBanner/>`
        in place of the whole component, so one refused sort took the rows and
        the headers with it — and since the sort
        lived in React state rather than the URL, the header that would have
        toggled it back off was gone too, leaving a page reload as the only way
        out. The banner now sits ABOVE the grid: the operator keeps the last page
        the server actually served, and keeps every control they need to try
        something else.
      */}
      {setup.readError !== undefined && (
        <ReadErrorNotice
          error={setup.readError}
          onRetry={setup.handleRefresh}
          sortColumnLabel={columnLabelOf(props, setup.refusedSortColumn)}
        />
      )}
      {props.viewSwitcher !== undefined && tableName !== '' && (
        <ViewSwitcher
          table={tableName}
          allLabel={props.viewSwitcher.allLabel}
          {...(props.isViewBound === true &&
            props.dataSource.view !== undefined && { configuredView: props.dataSource.view })}
          sessionView={setup.ui.view}
          onSelect={setup.ui.setView}
          inAddress={props.publishes?.url === true}
        />
      )}
      <AccountSessionsContext.Provider value={sessionsList}>
        <DataTableView
          containerRef={clipboardRef}
          table={setup.table}
          {...optionalProps}
          readOnly={isReadOnly}
          layout={props.layout}
          phoneLayout={props.phoneLayout}
          tableName={tableName}
          allColumns={setup.allColumns}
          totalRecords={setup.totalRecords}
          isLoading={setup.isLoading}
          selectionConfig={effectiveSelection({
            selectionConfig: props.selection,
            publishesSelection: props.publishes !== undefined,
          })}
          bulkActionsConfig={props.bulkActions}
          paginationConfig={
            failedEmpty ? undefined : pagerPagination(props.pagination, props.dataSource.limit)
          }
          cursorPaged={setup.cursorFeed.cursorPaged}
          hasMore={setup.cursorFeed.hasMore}
          isLoadingMore={setup.cursorFeed.isLoadingMore}
          onLoadMore={setup.cursorFeed.onLoadMore}
          groupByConfig={setup.effectiveGroupByConfig}
          {...(setup.groupCounts && { groupCounts: setup.groupCounts })}
          {...(setup.groupAggregations && { groupAggregations: setup.groupAggregations })}
          summaryConfig={props.summary}
          summaryAggregations={setup.summaryAggregations}
          columnConfig={props.columns}
          tableFields={props.tableFields}
          fieldMeta={props.fieldMeta}
          striped={striped}
          rowColorField={props.rowColorField}
          rowColorFieldColors={props.rowColorFieldColors}
          currentRowHeight={setup.currentRowHeight}
          cellClass={setup.cellClass}
          borderClass={setup.borderClass}
          emptyMessage={emptyMessage}
          {...(props.noMatchMessage !== undefined && { noMatchMessage: props.noMatchMessage })}
          selectedCount={Object.keys(setup.rowSelection).length}
          editingCell={setup.inlineEditing.editingCell}
          autoSave={setup.inlineAutoSave}
          saveError={setup.inlineEditing.saveError}
          saveConflict={setup.inlineEditing.saveConflict}
          onRetrySave={() => void setup.inlineEditing.retryFailedSave()}
          saveStatus={setup.inlineEditing.saveStatus}
          saveIndicator={setup.saveIndicator}
          onRowClickAction={onRowClickAction}
          onCellDoubleClick={setup.inlineEditing.startEditing}
          onEditSave={setup.inlineEditing.saveEdit}
          onEditCancel={setup.inlineEditing.cancelEditing}
          onCellCommit={setup.inlineEditing.commitCellValue}
          onRefresh={setup.handleRefresh}
          canCreate={showCreate}
          canDelete={!isReadOnly && props.canDelete !== false}
          isViewBound={props.isViewBound === true}
          globalFilter={setup.searchQuery}
          subscribed={(props.dataSource.bindTo ?? props.dataSource.system?.bindTo) !== undefined}
          narrowed={setup.narrowed}
          onBulkExecute={setup.onBulkExecute}
          conflict={setup.conflict}
          onDismissConflict={setup.dismissConflict}
          connectionStatus={setup.connectionStatus}
          ui={setup.ui}
        />
      </AccountSessionsContext.Provider>
    </GridStringsContext.Provider>
  )
}
