/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useContext, useMemo, useState } from 'react'
import { type FieldMetaMap } from '../../hooks/use-inline-editing'
import { isRateLimitedRead, RateLimitedNotice } from '../../runtime/read-failure'
import { type DataTableRowClickAction } from '../body'
import { usePasteImport } from '../paste-preview/use-paste-import'
import { coerceFieldValues, createRecord } from './create-record-data'
import { GridStringsContext, type GridStrings } from './grid-strings'
import { withColumnDisplayFields } from './island-setup-helpers'
import { useClipboardCopy } from './use-clipboard-copy'
import { useDataTableIslandSetup } from './use-island-setup'
import { DataTableView } from './view/data-table-view'
import type { AutoSaveConfig } from '@/domain/models/app/pages/components/auto-save'
import type {
  DataTableBulkAction,
  DataTableColumn,
  DataTableLayout,
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
} from '@/domain/models/app/pages/components/component-types/data/table/schema'
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
  /**
   * How the grid occupies its parent. Omitted (or `flow`) is the natural height
   * the page scrolls past — every grid written before this key existed. `fill`
   * takes the bounded parent's leftover height and, with it, the scroll: the
   * rows move inside the grid, the column heads stay pinned to that movement,
   * and the pager stays at the bottom edge. One value for four consequences,
   * because a grid that gets three of them is broken rather than half dressed.
   */
  readonly layout?: DataTableLayout
  /**
   * The grid reads through one of its table's views (`dataSource.view`). A
   * view is a projection, and writes stay on the table, so a view-bound grid is
   * read-only exactly as a system source is: no create, no inline edit, no CSV
   * import, no saved views, no live refresh.
   */
  readonly isViewBound?: boolean
  readonly searchSourceId?: string
  readonly tableFields?: readonly string[]
  readonly fieldMeta?: FieldMetaMap
  /**
   * The bound table's declared `permissions` block, forwarded verbatim.
   *
   * DESCRIPTIVE ONLY — it gates nothing, and must not. A permission answer needs
   * the acting role, which the island never receives; the gate is `canUpdate`
   * below, decided server-side. The type was `{ update?: readonly string[] }`,
   * which could not even represent `update: 'all'`.
   */
  readonly tablePermissions?: Readonly<Record<string, unknown>>
  /**
   * Whether inline editing should be OFFERED by default on this grid
   * — the permission-derived default behind a
   * column's `editable`, computed server-side from the session role and the
   * table's declared `update` grant.
   *
   * Only an explicit `true` enables anything: absent (auth not configured, a
   * system-source binding, or a table declaring no `update` grant) leaves every
   * grid read-only, exactly as today. A column's own `editable` still wins in
   * both directions.
   */
  readonly canUpdate?: boolean
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
  /**
   * The grid's other interface strings (toolbar, pager, search default,
   * add-row), resolved server-side and sent only where they differ from the
   * English each control is written in — absent on an English page.
   */
  readonly uiStrings?: GridStrings
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
        readonly openInNewTab?: boolean
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

/**
 * Whether the grid may write at all. A system source has no table to write to;
 * a view-bound grid reads a projection whose writes stay on the table. Both
 * take the same read-only posture, decided here once.
 */
function isReadOnlyBinding(props: DataTableIslandProps): boolean {
  return isSystemSourceBinding(props) || props.isViewBound === true
}

/**
 * A view-bound grid's columns with every author `editable` switched off —
 * reading through a view never opens an editor, whatever a column declares.
 */
function withViewBoundReadOnly(
  columns: readonly DataTableColumn[] | undefined,
  isViewBound: boolean
): readonly DataTableColumn[] | undefined {
  if (!columns || !isViewBound) return columns
  return columns.map((col) => ('field' in col ? { ...col, editable: false } : col))
}

/**
 * A view-bound grid's toolbar with export switched off. The export route is
 * the TABLE's, gated on the table's own read grant — which a visitor on a
 * public view does not hold — so the affordance would only ever answer 401.
 */
function withViewBoundToolbar(props: DataTableIslandProps): DataTableToolbar | undefined {
  return props.isViewBound === true && props.toolbar?.export === true
    ? { ...props.toolbar, export: false }
    : props.toolbar
}

/**
 * Resolves the documented default of `ColumnSchema.editable` — "default: from
 * table permissions" — once, at the island boundary,
 * by stamping `editable: true` onto the columns entitled to it.
 *
 * Resolving here rather than at each point of use is what keeps double-click
 * editing and Tab navigation agreeing about which cells are editable: both read
 * the same `columnConfig`, so neither can derive a different answer.
 *
 * Only a column that declares NO `editable` is touched, which is the whole
 * resolution order:
 *
 *   1. explicit `false` — the author's opt-OUT, which survives a table granting
 * `update`
 *   2. explicit `true`  — the author's opt-IN, which survives a table that does
 * not
 *   3. otherwise the permission-derived default
 *   4. otherwise closed — every gate downstream tests `editable === true`, so an
 *      unresolved column cannot open an editor
 */
function withPermissionEditableDefault(
  columns: readonly DataTableColumn[] | undefined,
  permissionEditable: boolean
): readonly DataTableColumn[] | undefined {
  if (!columns || !permissionEditable) return columns
  return columns.map((col) =>
    'field' in col && col.editable === undefined ? { ...col, editable: true } : col
  )
}

/**
 * Whether this grid may take the permission-derived inline-edit default, and the
 * three states it deliberately falls closed on.
 *
 * A system source is read-only — there is no records table to write to —
 * mirroring the create affordance's own system-source gate.
 *
 * The other two mirror `rowIsClickable` in `data-row.tsx` verbatim
 * (`hasRowAction || selectionMode === 'single'`), because that is the exact
 * condition under which an editable cell STOPS a click from reaching its row
 * (rule R1). R1 is right for editability the author DECLARED: writing
 * `editable: true` beside `onRowClick` is knowingly accepting the trade. It is
 * wrong for editability merely DERIVED from a permission, where the author asked
 * for a clickable row and never asked for editing at all — swallowing that click
 * would break row-click navigation and single-row
 * selection on every grid whose table grants `update`.
 * A declared `editable` still wins either way; only the DEFAULT yields.
 */
function permissionEditableAllowed(props: DataTableIslandProps): boolean {
  return (
    props.canUpdate === true &&
    !isReadOnlyBinding(props) &&
    props.onRowClick === undefined &&
    props.selection?.mode !== 'single'
  )
}

/** Maps island props to the parameter bag {@link useDataTableIslandSetup} expects. */
function toSetupParams(props: DataTableIslandProps) {
  return {
    dataSource: props.dataSource,
    columnConfig: withViewBoundReadOnly(
      withPermissionEditableDefault(props.columns, permissionEditableAllowed(props)),
      props.isViewBound === true
    ),
    isViewBound: props.isViewBound === true,
    paginationConfig: props.pagination,
    searchConfig: props.search,
    selectionConfig: props.selection,
    toolbarConfig: withViewBoundToolbar(props),
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
  readOnly: boolean
) {
  return {
    containerRef,
    // System-source grids have no DB table to write to — `table` is absent.
    tableName: props.dataSource.table ?? '',
    tableFields: props.tableFields ?? [],
    fieldMeta: props.fieldMeta,
    onImported,
    enabled: !readOnly,
  }
}

/**
 * Narrow the schema-level `onRowClick` (any action variant) down to the
 * shapes the data-table row-click handler consumes:
 *
 * - `navigate` — `{ type: 'navigate', path: <string>, openInNewTab? }`
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
    return action.openInNewTab === true
      ? { type: 'navigate', path: action.path, openInNewTab: true }
      : { type: 'navigate', path: action.path }
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

/**
 * The island's props with each column's `displayField` merged into `fieldMeta`.
 *
 * Done once, at the entry, so every consumer of `fieldMeta` — the picker, the
 * create dialog, paste-import, the cells — reads the same field meta. Merged
 * into one place rather than re-derived per consumer, which is how two of them
 * would come to search a relationship on different columns.
 */
function useColumnDisplayFieldMeta(props: DataTableIslandProps): DataTableIslandProps {
  const { fieldMeta: declared, columns } = props
  const fieldMeta = useMemo(() => withColumnDisplayFields(declared, columns), [declared, columns])
  return useMemo(
    () => (fieldMeta === declared ? props : { ...props, fieldMeta }),
    [props, fieldMeta, declared]
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
  // Saved/user views are a DB-table-only feature — never offered for a system
  // source (there is no table id to key personal views on).
  const viewsEnabled = !isReadOnly && setup.viewsEnabled
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
      <DataTableView
        containerRef={clipboardRef}
        table={setup.table}
        {...optionalProps}
        readOnly={isReadOnly}
        layout={props.layout}
        tableName={tableName}
        allColumns={setup.allColumns}
        totalRecords={setup.totalRecords}
        // Treat user-preferences/saved-views in-flight as a loading state too
        // so the table doesn't render rows in the schema-default density
        // before the persisted density lands.
        isLoading={isLoading}
        searchConfig={setup.resolvedSearchConfig}
        selectionConfig={props.selection}
        toolbarConfig={withViewBoundToolbar(props)}
        bulkActionsConfig={props.bulkActions}
        paginationConfig={props.pagination}
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
        // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop -- discards the click event so the retry is not passed a MouseEvent as its argument; the alert this lands on only renders after a save has already failed.
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
    </GridStringsContext.Provider>
  )
}
