/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useContext } from 'react'
import { isRateLimitedRead, RateLimitedNotice } from '../../runtime/read-failure'
import { AccountSessionsContext, isAccountSessionsEndpoint } from '../account-sessions'
import { usePasteImport } from '../paste-preview/use-paste-import'
import {
  DEFAULT_CANCEL_LABEL,
  DEFAULT_SAVE_LABEL,
  isReadOnlyBinding,
  resolveRowClickAction,
  toPasteParams,
  toSetupParams,
  useColumnDisplayFieldMeta,
  useDataTableCreateFlow,
  withViewBoundToolbar,
} from './entry-wiring'
import { GridStringsContext, type GridStrings } from './grid-strings'
import { pagerPagination } from './setup/row-cap'
import { useClipboardCopy } from './use-clipboard-copy'
import { useDataTableIslandSetup } from './use-island-setup'
import { DataTableView } from './view/data-table-view'
import type { DataTableIslandProps } from './island-props'

/** The provider value of a grid whose host sent no strings: every control keeps its English. */
const NO_UI_STRINGS: GridStrings = {}

/**
 * The grid's load-failure alert. Operator-facing, so it states what failed and
 * what to do about it — not a raw response envelope.
 *
 * It used to render `Failed to load data: ` in front of a message that already
 * began `Failed to fetch system rows: `, and the fetch appended the response
 * body, so an operator met
 * `Failed to load data: Failed to fetch system rows: 400 {"success":false,…}`.
 * Two prefixes and a JSON blob. The status is kept because 400 / 403 / 500 tell
 * an operator genuinely different things; the envelope now lives on the Error's
 * `cause` for the console.
 */
function ErrorBanner({ error }: { readonly error: unknown }) {
  return (
    <div
      role="alert"
      className="border-error-border bg-error-bg text-error-fg text-md rounded border p-4"
    >
      <p className="font-medium">This data could not be loaded.</p>
      <p className="mt-1">
        {error instanceof Error ? error.message : 'The server sent no readable response.'} Refresh
        to try again.
      </p>
    </div>
  )
}

/** A rate-limited read offers a Retry; any other failure keeps the banner. */
function ReadErrorNotice({
  error,
  onRetry,
}: {
  readonly error: unknown
  readonly onRetry: () => void
}) {
  const strings = useContext(GridStringsContext)
  return isRateLimitedRead(error) ? (
    <RateLimitedNotice
      onRetry={onRetry}
      strings={strings}
    />
  ) : (
    <ErrorBanner error={error} />
  )
}

// eslint-disable-next-line max-lines-per-function, complexity -- thin coordinator: 60+ lines of prop-forwarding wiring whose ?? / && short-circuit defaults aggregate one past the threshold; further extraction would obscure the call site
export default function DataTableIsland(islandProps: DataTableIslandProps) {
  const props = useColumnDisplayFieldMeta(islandProps)
  const isReadOnly = isReadOnlyBinding(props)
  const setup = useDataTableIslandSetup(toSetupParams(props))
  // Clipboard + paste-import: cell/row selection + Ctrl/Cmd+C / +V handlers.
  // Paste-import (CSV-via-clipboard) targets a DB table; for a system source
  // there is no records table to write to, so it is gated OFF.
  const clipboardRef = useClipboardCopy()
  const paste = usePasteImport(toPasteParams(props, clipboardRef, setup.handleRefresh, isReadOnly))
  const onRowClickAction = resolveRowClickAction(props.onRowClick)

  const { creating, onCreate, onCancelCreate, onSubmitCreate } = useDataTableCreateFlow(
    props.dataSource.table ?? '',
    setup.handleRefresh,
    props.fieldMeta
  )
  // A system source is read-only: never offer the "Nouvel enregistrement"
  // create affordance (there is no records table to write to). Otherwise the
  // button is offered unless the server explicitly denied create for the role.
  const showCreate = !isReadOnly && props.canCreate !== false
  // Optional props applied only when present (keeps the JSX spread free of inline
  // boolean operators that would inflate this component's cyclomatic complexity).
  const optionalProps = {
    ...(props.ariaLabel && { ariaLabel: props.ariaLabel }),
    // System-source CSV export: the toolbar `Exporter` affordance navigates to
    // this endpoint's `?format=csv` (there is no DB table to route through the
    // records export). Present only for a `dataSource.system` binding.
    ...(props.dataSource.system?.endpoint && {
      systemExportEndpoint: props.dataSource.system.endpoint,
    }),
  }
  // Pre-resolve the remaining short-circuit defaults out of the JSX so they
  // don't count toward this component's cyclomatic complexity.
  const tableName = props.dataSource.table ?? ''
  const striped = props.striped ?? false
  const emptyMessage = props.emptyMessage ?? 'No records found'
  // A grid of the reader's own sessions marks each row current or not.
  const sessionsList = isAccountSessionsEndpoint(props.dataSource.system?.endpoint)

  return (
    <GridStringsContext.Provider value={props.uiStrings ?? NO_UI_STRINGS}>
      {paste.dialog}
      {paste.toast}
      {/*
        A failed read is TOLD, not enacted. This used to `return <ErrorBanner/>`
        in place of the whole component, so one refused sort took the rows, the
        headers, the toolbar and the search box with it — and since the sort
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
          searchConfig={setup.resolvedSearchConfig}
          selectionConfig={props.selection}
          toolbarConfig={withViewBoundToolbar(props)}
          bulkActionsConfig={props.bulkActions}
          paginationConfig={pagerPagination(props.pagination, props.dataSource.limit)}
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
          globalFilter={setup.globalFilter}
          setGlobalFilter={setup.setGlobalFilter}
          striped={striped}
          rowColorField={props.rowColorField}
          rowColorFieldColors={props.rowColorFieldColors}
          currentRowHeight={setup.currentRowHeight}
          cellClass={setup.cellClass}
          borderClass={setup.borderClass}
          emptyMessage={emptyMessage}
          {...(props.noMatchMessage !== undefined && { noMatchMessage: props.noMatchMessage })}
          selectedCount={Object.keys(setup.rowSelection).length}
          showSearch={setup.showSearch}
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
          newRecordLabel={props.newRecordLabel ?? 'New record'}
          saveLabel={props.saveLabel ?? DEFAULT_SAVE_LABEL}
          cancelLabel={props.cancelLabel ?? DEFAULT_CANCEL_LABEL}
          creating={creating}
          onCreate={onCreate}
          onCancelCreate={onCancelCreate}
          onSubmitCreate={onSubmitCreate}
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
