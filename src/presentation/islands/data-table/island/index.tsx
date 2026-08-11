/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useMemo, useState } from 'react'
import { type FieldMetaMap } from '../../hooks/use-inline-editing'
import { type DataTableRowClickAction } from '../body'
import { usePasteImport } from '../paste-preview/use-paste-import'
import { coerceFieldValues, createRecord } from './create-record-data'
import { DataTableView } from './data-table-view'
import { useClipboardCopy } from './use-clipboard-copy'
import { useDataTableIslandSetup } from './use-island-setup'
import type { AutoSaveConfig } from '@/domain/models/app/pages/components/auto-save'
import type {
  DataTableBulkAction,
  DataTableColumn,
  DataTablePagination,
  ComponentSearch,
  DataTableSelection,
  DataTableSystemSource,
  DataTableToolbar,
  DataTableGroupBy,
  DataTableSummaryItem,
  DataTableKanbanGroupBy,
  DataTableViewLabels,
  DataTableViewType,
  RowHeight,
} from '@/domain/models/app/pages/components/component-types/data/data-table/schema'
import type { DataFilter, DataSort } from '@/domain/models/app/pages/components/data-source'

interface DataTableIslandProps {
  /**
   * Accessible name for the grid.
   * Rendered as `aria-label` on the `role="grid"` table so
   * `getByRole('grid', { name })` resolves. Optional — absent for grids that
   * derive their name from surrounding context.
   */
  readonly ariaLabel?: string
  readonly dataSource: {
    /**
     * Bound DB table name. Present for the DB-table binding; ABSENT for a
     * system-source binding (`dataSource.system`), where rows come from a read
     * endpoint instead of a declared table.
     */
    readonly table?: string
    readonly view?: string
    readonly filter?: readonly DataFilter[]
    readonly sort?: readonly DataSort[]
    /** Data refresh strategy (`'poll'` enables interval re-fetch). */
    readonly refreshMode?: 'none' | 'poll' | 'realtime'
    /** Poll interval in milliseconds (used when `refreshMode` is `'poll'`). */
    readonly pollIntervalMs?: number
    /**
     * Cross-component shared-filter binding ([internal ref],
     * DB-table case): `bindTo` references a sibling publisher whose value is merged
     * into the records request as the `sharedFilter.params` when both are present.
     */
    readonly bindTo?: string
    readonly sharedFilter?: { readonly params?: readonly string[] }
    /**
     * System read-endpoint binding:
     * feed the grid from a named read endpoint instead of a DB table. When
     * present, DB-table-only features (record writes, saved/user views,
     * user-preferences, realtime/SSE, CSV import) are gated OFF — sort / filter /
     * search / pagination stay ON (read-only, endpoint/client-side).
     */
    readonly system?: DataTableSystemSource
  }
  readonly columns?: readonly DataTableColumn[]
  readonly pagination?: DataTablePagination
  readonly search?: ComponentSearch
  readonly selection?: DataTableSelection
  readonly toolbar?: DataTableToolbar
  readonly bulkActions?: readonly DataTableBulkAction[]
  readonly striped?: boolean
  /**
   * Field whose declared option colours fill each row — the grid's spelling of
   * the record views' `colorField`.
   */
  readonly rowColorField?: string
  /**
   * `optionValue → #RRGGBB` for the field `rowColorField` names, resolved
   * server-side from `app.tables` (the island only ever sees records).
   */
  readonly rowColorFieldColors?: Readonly<Record<string, string>>
  readonly bordered?: boolean
  readonly emptyMessage?: string
  /**
   * Message shown when a client-side search/filter reduces a NON-empty dataset
   * to zero rows — the no-match state, distinct from `emptyMessage` (the
   * zero-record empty state). Rendered in an `aria-live` `role="status"` region;
   * a `{query}` token is substituted with the active search string so the
   * message echoes what was searched. Falls back to `emptyMessage` when omitted.
   */
  readonly noMatchMessage?: string
  readonly showRowNumbers?: boolean
  readonly rowHeight?: RowHeight
  readonly searchSourceId?: string
  readonly tableFields?: readonly string[]
  readonly fieldMeta?: FieldMetaMap
  readonly tablePermissions?: { readonly update?: readonly string[] }
  /**
   * Whether the current role may create records in the bound table
   *. Computed server-side from the session role
   * + the table's `create` permission. When true the toolbar offers the primary
   * "Nouvel enregistrement" create affordance (a modal with one labelled textbox
   * per field that POSTs to `/api/tables/:t/records` and refreshes the grid);
   * when false (or undefined, e.g. auth not configured) the affordance defaults
   * are: false → button ABSENT (anti-enumeration), undefined → button offered
   * (no-auth full-access model).
   */
  readonly canCreate?: boolean
  /**
   * Interpreter-provided create-record label, resolved server-side
   * against the active page language ("New record" default, "Nouvel
   * enregistrement" for French, or an author override). Labels the toolbar
   * create button and the create modal's title/aria-label so they localize.
   * Defaults to the English string when absent.
   */
  readonly newRecordLabel?: string
  /**
   * Interpreter-provided commit / dismiss labels, resolved server-side the same
   * way. They label the create dialog's footer pair and the inline
   * select-editor's commit + cancel pair (an `editSelect.saveLabel` still wins
   * for that one button). Default to the English strings when absent.
   */
  readonly saveLabel?: string
  readonly cancelLabel?: string
  readonly groupBy?: DataTableGroupBy
  readonly summary?: readonly DataTableSummaryItem[]
  readonly autoSave?: AutoSaveConfig
  /**
   * Developer-configured table views surfaced from `app.tables[i].views[]`.
   * Read-only — the user can fork them via `Save as new` but cannot overwrite
   * or delete them. The numeric `id` from the schema is normalised to string
   * here so the Views menu can key uniformly across developer + personal
   * sources.
   */
  readonly tableViews?: ReadonlyArray<{
    readonly id: string
    readonly name: string
    readonly filters?: ReadonlyArray<{
      readonly field: string
      readonly operator: string
      readonly value: unknown
    }>
    readonly sorts?: ReadonlyArray<{
      readonly field: string
      readonly direction: 'asc' | 'desc'
    }>
    readonly groupBy?: string | null
  }>
  /**
   * Row-click action surfaced from the schema's `onRowClick`. The foundation
   * tier consumes two variants:
   *
   * - `{ type: 'navigate', path }` — the path may contain `$record.<field>`
   *   tokens substituted at click time against the clicked row's data.
   * - `{ action: 'openDrawer', component }` (PG-04) — dispatches a
   *   `sovrium:open-drawer` CustomEvent so the named drawer island opens.
   *   Note: discriminated by `action` (not `type`) per the schema.
   *
   * Non-supported variants pass through unchanged but are ignored by the
   * row-click handler.
   */
  readonly onRowClick?:
    | {
        readonly type?: string
        readonly action?: string
        readonly path?: string
        readonly component?: string
      }
    | undefined
  /**
   * Ordered view types the toolbar's switcher offers.
   * The order is the tab order, and the set is COMPLETE — `grid` is not
   * implicit, so an author can offer a board-only surface.
   */
  readonly views?: readonly DataTableViewType[]
  /** Localizable switcher labels; each key falls back to its English default. */
  readonly viewLabels?: DataTableViewLabels
  /** Field whose distinct values become the kanban board's columns. */
  readonly kanbanGroupBy?: DataTableKanbanGroupBy
  /** Date field that positions each record on the calendar view. */
  readonly dateField?: string
}

/**
 * View types offered when a config declares none — the pre-existing behaviour
 * of every config written before `views` existed.
 */
const DEFAULT_DECLARED_VIEWS: readonly DataTableViewType[] = ['grid']

/**
 * Platform-default (English) control labels. The SSR host normally supplies the
 * language-resolved strings; these only cover a host that mounts the island
 * without them.
 */
const DEFAULT_SAVE_LABEL = 'Save'
const DEFAULT_CANCEL_LABEL = 'Cancel'

function ErrorBanner({ error }: { readonly error: unknown }) {
  return (
    <div
      role="alert"
      className="border-error-border bg-error-bg text-error-fg rounded border p-4 text-sm"
    >
      Failed to load data: {error instanceof Error ? error.message : 'Unknown error'}
    </div>
  )
}

/**
 * A system-source data-table is read-only: its rows come from a named read
 * endpoint (`dataSource.system`), not a declared DB table. This single
 * derivation drives every DB-table-only feature gate (writes / saved views /
 * user-preferences / realtime / CSV import) so the read-only posture is decided
 * in ONE place rather than scattered across the wiring.
 */
function isSystemSourceBinding(props: DataTableIslandProps): boolean {
  return props.dataSource.system !== undefined
}

/** Maps island props to the parameter bag {@link useDataTableIslandSetup} expects. */
function toSetupParams(props: DataTableIslandProps) {
  return {
    dataSource: props.dataSource,
    columnConfig: props.columns,
    paginationConfig: props.pagination,
    searchConfig: props.search,
    selectionConfig: props.selection,
    toolbarConfig: props.toolbar,
    initialRowHeight: props.rowHeight ?? 'medium',
    searchSourceId: props.searchSourceId,
    tableFields: props.tableFields,
    fieldMeta: props.fieldMeta,
    groupByConfig: props.groupBy,
    summaryConfig: props.summary,
    showRowNumbers: props.showRowNumbers,
    bordered: props.bordered ?? false,
    autoSaveConfig: props.autoSave,
    tableViews: props.tableViews,
    saveLabel: props.saveLabel ?? DEFAULT_SAVE_LABEL,
    cancelLabel: props.cancelLabel ?? DEFAULT_CANCEL_LABEL,
  }
}

/** Maps island props to the parameter bag {@link usePasteImport} expects. */
function toPasteParams(
  props: DataTableIslandProps,
  containerRef: React.RefObject<HTMLDivElement | null>,
  onImported: () => void,
  isSystemSource: boolean
) {
  return {
    containerRef,
    // System-source grids have no DB table to write to — `table` is absent.
    tableName: props.dataSource.table ?? '',
    tableFields: props.tableFields ?? [],
    fieldMeta: props.fieldMeta,
    onImported,
    enabled: !isSystemSource,
  }
}

/**
 * Narrow the schema-level `onRowClick` (any action variant) down to the
 * shapes the data-table row-click handler consumes:
 *
 * - `navigate` — `{ type: 'navigate', path: <string> }`
 * - `openDrawer` (PG-04) — `{ action: 'openDrawer', component: <drawer-id> }`
 *   discriminated by `action` (not `type`) per the OpenDrawerActionSchema.
 *
 * Returns `undefined` for unknown / unsupported variants so the row-click
 * handler remains a no-op rather than crashing on a malformed payload.
 */
function resolveRowClickAction(
  action: DataTableIslandProps['onRowClick']
): DataTableRowClickAction | undefined {
  if (!action) return undefined
  if (action.type === 'navigate' && typeof action.path === 'string') {
    return { type: 'navigate', path: action.path }
  }
  if (action.action === 'openDrawer' && typeof action.component === 'string') {
    return { type: 'openDrawer', component: action.component }
  }
  return undefined
}

/**
 * Toolbar create-record flow: the `creating` modal
 * toggle plus the open / cancel / submit callbacks. On submit we POST only the
 * filled fields (untouched fields would 500 typed columns), coercing each value
 * to its column's JSON type (numeric columns as numbers, not `"42"`) via
 * `fieldMeta` so a typed column never 500s on create, and on success close the
 * modal + refresh the grid so the new row shows. Extracted from
 * `DataTableIsland` to keep that component under the complexity cap.
 */
function useDataTableCreateFlow(
  tableName: string,
  refresh: () => void,
  fieldMeta: FieldMetaMap | undefined
) {
  const [creating, setCreating] = useState(false)
  const fieldTypes = useMemo(
    () =>
      new Map(Object.entries(fieldMeta ?? {}).map(([name, meta]) => [name, meta.type] as const)),
    [fieldMeta]
  )
  const onCreate = useCallback(() => setCreating(true), [])
  const onCancelCreate = useCallback(() => setCreating(false), [])
  const onSubmitCreate = useCallback(
    (values: Record<string, string>) => {
      setCreating(false)
      const filled = Object.fromEntries(
        Object.entries(values).filter(([, value]) => value.trim().length > 0)
      )
      // Coerce each value to the JSON type its column expects (numeric columns as
      // numbers, booleans as booleans) so the POST body matches the records-API
      // contract — a typed column never 500s on an otherwise-valid create.
      const coerced = coerceFieldValues(filled, fieldTypes)
      void createRecord(tableName, coerced).then((ok) => {
        if (ok) refresh()
      })
    },
    [tableName, refresh, fieldTypes]
  )
  return { creating, onCreate, onCancelCreate, onSubmitCreate }
}

// eslint-disable-next-line max-lines-per-function, complexity -- thin coordinator: 60+ lines of prop-forwarding wiring whose ?? / && short-circuit defaults aggregate one past the threshold; further extraction would obscure the call site
export default function DataTableIsland(props: DataTableIslandProps) {
  const isSystemSource = isSystemSourceBinding(props)
  const setup = useDataTableIslandSetup(toSetupParams(props))
  // Clipboard + paste-import: cell/row selection + Ctrl/Cmd+C / +V handlers.
  // Paste-import (CSV-via-clipboard) targets a DB table; for a system source
  // there is no records table to write to, so it is gated OFF.
  const clipboardRef = useClipboardCopy()
  const paste = usePasteImport(
    toPasteParams(props, clipboardRef, setup.handleRefresh, isSystemSource)
  )
  const onRowClickAction = resolveRowClickAction(props.onRowClick)

  const { creating, onCreate, onCancelCreate, onSubmitCreate } = useDataTableCreateFlow(
    props.dataSource.table ?? '',
    setup.handleRefresh,
    props.fieldMeta
  )
  // A system source is read-only: never offer the "Nouvel enregistrement"
  // create affordance (there is no records table to write to). Otherwise the
  // button is offered unless the server explicitly denied create for the role.
  const showCreate = !isSystemSource && props.canCreate !== false
  // Saved/user views are a DB-table-only feature — never offered for a system
  // source (there is no table id to key personal views on).
  const viewsEnabled = !isSystemSource && setup.viewsEnabled
  // Optional props applied only when present (keeps the JSX spread free of inline
  // boolean operators that would inflate this component's cyclomatic complexity).
  const optionalProps = {
    ...(props.ariaLabel && { ariaLabel: props.ariaLabel }),
    ...(setup.activeViewName && { activeViewName: setup.activeViewName }),
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
  const isLoading = setup.isLoading || setup.isPrefsLoading
  const striped = props.striped ?? false
  const emptyMessage = props.emptyMessage ?? 'No records found'
  const declaredViews = props.views ?? DEFAULT_DECLARED_VIEWS

  if (setup.isError) return <ErrorBanner error={setup.error} />

  return (
    <>
      {paste.dialog}
      {paste.toast}
      <DataTableView
        containerRef={clipboardRef}
        table={setup.table}
        {...optionalProps}
        readOnly={isSystemSource}
        tableName={tableName}
        allColumns={setup.allColumns}
        totalRecords={setup.totalRecords}
        // Treat user-preferences/saved-views in-flight as a loading state too
        // so the table doesn't render rows in the schema-default density
        // before the persisted density lands.
        isLoading={isLoading}
        searchConfig={props.search}
        selectionConfig={props.selection}
        toolbarConfig={props.toolbar}
        bulkActionsConfig={props.bulkActions}
        paginationConfig={props.pagination}
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
        saveStatus={setup.inlineEditing.saveStatus}
        saveTarget={setup.inlineEditing.saveTarget}
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
        currentDensity={setup.currentDensity}
        onSelectDensity={setup.onSelectDensity}
        onResetPreferences={setup.onResetPreferences}
        onBulkExecute={setup.onBulkExecute}
        conflict={setup.conflict}
        onDismissConflict={setup.dismissConflict}
        connectionStatus={setup.connectionStatus}
        ui={setup.ui}
        viewsEnabled={viewsEnabled}
        viewEntries={setup.viewEntries}
        canSaveCurrentView={setup.canSaveCurrentView}
        isViewModified={setup.isViewModified}
        onSelectView={setup.onSelectView}
        onSaveNewView={setup.onSaveNewView}
        onSaveModifiedView={setup.onSaveModifiedView}
        onConfirmDeleteView={setup.onConfirmDeleteView}
        views={declaredViews}
        {...(props.viewLabels && { viewLabels: props.viewLabels })}
        {...(props.kanbanGroupBy && { kanbanGroupBy: props.kanbanGroupBy })}
        {...(props.dateField !== undefined && { dateField: props.dateField })}
      />
    </>
  )
}
