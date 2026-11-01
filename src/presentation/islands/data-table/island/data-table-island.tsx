/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useMemo } from 'react'
import { AccountSessionsContext, isAccountSessionsEndpoint } from '../account-sessions'
import { usePasteImport } from '../paste-preview/use-paste-import'
import { useViewLayout } from '../view-options/view-layout'
import { ViewSwitcher } from '../view-options/view-switcher'
import {
  isReadOnlyBinding,
  resolveRowClickAction,
  toPasteParams,
  toSetupParams,
  useColumnDisplayFieldMeta,
} from './entry-wiring'
import { GridCaptionContext, useGridCaption } from './grid-caption'
import { GridStringsContext, type GridStrings } from './grid-strings'
import { usePhoneRowOpen } from './phone-row-open'
import { ReadErrorNotice } from './read-error-notice'
import { readFailureWiring } from './read-failure-wiring'
import { useClipboardCopy } from './use-clipboard-copy'
import { useDataTableIslandSetup } from './use-island-setup'
import { usePublishedSelection } from './use-published-selection'
import { DataTableView } from './view/data-table-view'
import { toDataTableViewProps } from './view-wiring'
import type { DataTableIslandProps } from './island-props'
import type { ReactElement } from 'react'

/** The provider value of a grid whose host sent no strings: every control keeps its English. */
const NO_UI_STRINGS: GridStrings = {}

/**
 * The grid's strings, with the pager's range replaced by the endpoint's own
 * sentence for the result when it sends one (`35 runs · 3 failed`), and the
 * page readout shortened to `1 / 2` on a phone to make room for it.
 */
function useGridStrings(strings: GridStrings | undefined, summary: string | undefined) {
  return useMemo(
    () =>
      summary === undefined
        ? (strings ?? NO_UI_STRINGS)
        : {
            ...strings,
            'datatable.pagination.range': summary,
            // A grid that does not page counts its rows in the same phrase.
            'sharedFilter.resultCount': summary,
            'sharedFilter.resultCountOne': summary,
            'datatable.pagination.rows': summary,
            'datatable.pagination.rowsOne': summary,
            // The sentence takes the width a phone's `Page 1 of 2` had.
            'datatable.pagination.pageShort': '{page} / {count}',
          },
    [strings, summary]
  )
}

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

/**
 * What sits above the grid: the read-failure notice and the view switcher.
 *
 * A failed read is TOLD, not enacted. This used to `return <ErrorBanner/>` in
 * place of the whole component, so one refused sort took the rows and the
 * headers with it — and since the sort lived in React state rather than the
 * URL, the header that would have toggled it back off was gone too, leaving a
 * page reload as the only way out. The notice now sits ABOVE the grid: the
 * operator keeps the last page the server actually served, and keeps every
 * control they need to try something else.
 */
function GridHeader({
  props,
  setup,
  clear,
  applyViewLayout,
}: {
  readonly props: DataTableIslandProps
  readonly setup: ReturnType<typeof useDataTableIslandSetup>
  readonly clear: ReturnType<typeof readFailureWiring>['clear']
  readonly applyViewLayout: ReturnType<typeof useViewLayout>
}): ReactElement {
  const tableName = props.dataSource.table ?? ''
  const configuredView = props.isViewBound === true ? props.dataSource.view : undefined
  return (
    <>
      {setup.readError !== undefined && (
        <ReadErrorNotice
          error={setup.readError}
          onRetry={setup.handleRefresh}
          sortColumnLabel={columnLabelOf(props, setup.refusedSortColumn)}
          named={props.tableReadFailure}
          {...clear}
        />
      )}
      {props.viewSwitcher !== undefined && tableName !== '' && (
        <ViewSwitcher
          table={tableName}
          allLabel={props.viewSwitcher.allLabel}
          {...(configuredView !== undefined && { configuredView })}
          sessionView={setup.ui.view}
          onSelect={setup.ui.setView}
          onLayout={applyViewLayout}
          inAddress={props.publishes?.url === true}
        />
      )}
    </>
  )
}

/**
 * The data-table island: a thin coordinator of the setup, clipboard, paste,
 * view-layout and selection hooks. Its view's whole prop bag is built by
 * {@link toDataTableViewProps}.
 */
export default function DataTableIsland(islandProps: DataTableIslandProps) {
  // On a phone a row opens like its Open action, and the action column is dropped.
  const props = usePhoneRowOpen(useColumnDisplayFieldMeta(islandProps))
  const isReadOnly = isReadOnlyBinding(props)
  const setup = useDataTableIslandSetup(toSetupParams(props))
  const gridStrings = useGridStrings(props.uiStrings, setup.resultSummary)
  const caption = useGridCaption(props.caption)
  // Clipboard + paste-import: cell/row selection + Ctrl/Cmd+C / +V handlers.
  // Paste-import (CSV-via-clipboard) targets a DB table; for a system source
  // there is no records table to write to, so it is gated OFF.
  const clipboardRef = useClipboardCopy()
  const paste = usePasteImport(toPasteParams(props, clipboardRef, setup.handleRefresh, isReadOnly))
  const applyViewLayout = useViewLayout(setup.table, setup.ui)
  usePublishedSelection(props.publishes, setup.table, setup.rowSelection)

  const searching = setup.searchQuery.trim() !== ''
  const failure = readFailureWiring({
    error: setup.readError,
    isError: setup.isError,
    rowCount: setup.table.getRowModel().rows.length,
    total: setup.totalRecords,
    channel: props.dataSource.bindTo,
    searching,
    clearReadError: setup.clearReadError,
  })
  const viewProps = toDataTableViewProps({
    props,
    setup,
    failure,
    readOnly: isReadOnly,
    searching,
    containerRef: clipboardRef,
    onRowClickAction: resolveRowClickAction(props.onRowClick),
  })

  return (
    <GridStringsContext.Provider value={gridStrings}>
      {paste.dialog}
      {paste.toast}
      <GridHeader
        props={props}
        setup={setup}
        clear={failure.clear}
        applyViewLayout={applyViewLayout}
      />
      {/* A grid of the reader's own sessions marks each row current or not. */}
      <AccountSessionsContext.Provider
        value={isAccountSessionsEndpoint(props.dataSource.system?.endpoint)}
      >
        <GridCaptionContext.Provider value={caption}>
          <DataTableView {...viewProps} />
        </GridCaptionContext.Provider>
      </AccountSessionsContext.Provider>
    </GridStringsContext.Provider>
  )
}
