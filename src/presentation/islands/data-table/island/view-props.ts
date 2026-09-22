/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { AlternateViewProps } from './alternate-view'
import type { TableContentProps } from './table-content'
import type { DataTableColumnDef, DataTableInstance } from './table-features'
import type { DataTableToolbarBarProps } from './toolbar/toolbar-bar'
import type { SaveIndicatorSettings } from './use-island-setup'
import type { useDataTableUiState } from './use-ui-state'
import type { ViewsMenuEntry } from './views-menu'
import type { EditingCell, FieldMetaMap, SaveStatus } from '../../hooks/use-inline-editing'
import type { DetectedConflict } from '../../hooks/use-realtime-reconciliation'
import type { RealtimeConnectionState } from '../../hooks/use-realtime-subscription'
import type { RowDensity } from '../../hooks/use-table-preferences'
import type { CellCommit, DataTableRowClickAction, InlineAutoSave } from '../body'
import type { SummaryAggregations } from '../summary-aggregate'
import type {
  DataTableBulkAction,
  DataTableColumn,
  DataTableGroupBy,
  DataTableLayout,
  DataTablePagination,
  ComponentSearch,
  DataTableSelection,
  DataTableSummaryItem,
  DataTableToolbar,
  DataTableKanbanGroupBy,
  DataTableViewLabels,
  DataTableViewType,
} from '@/domain/models/app/pages/components/component-types/data/table/schema'

/**
 * The full prop surface the island hands to its view.
 *
 * This is the island's internal render contract, kept in one place because the
 * view itself no longer reads it directly: `useViewProps` translates it into
 * the per-region bags each part of the view actually consumes.
 */
export interface DataTableViewProps {
  /** Ref attached to the table container — wires clipboard copy interaction. */
  readonly containerRef?: React.Ref<HTMLDivElement>
  readonly table: DataTableInstance
  /** Accessible name for the `role="grid"` table (optional). */
  readonly ariaLabel?: string
  readonly tableName: string
  readonly allColumns: readonly DataTableColumnDef[]
  readonly totalRecords: number
  readonly isLoading: boolean
  readonly searchConfig?: ComponentSearch
  readonly selectionConfig?: DataTableSelection
  readonly toolbarConfig?: DataTableToolbar
  readonly bulkActionsConfig?: readonly DataTableBulkAction[]
  readonly paginationConfig?: DataTablePagination
  /**
   * The grid is reading a CURSOR feed. Suppresses the page-number pager and its
   * "x–y of N" summary even when `paginationConfig` is declared: a cursor
   * envelope reports no total, so the pager could only invent one from the page
   * length — which is precisely what produced "1–25 of 25" over 30 rows, beside
   * a "Page 1 of 1" and a permanently disabled Next.
   */
  readonly cursorPaged?: boolean
  /** The endpoint reports more rows behind the ones on screen. */
  readonly hasMore?: boolean
  /** A continuation is in flight. */
  readonly isLoadingMore?: boolean
  /** Fetch the next page and append it to the rows already shown. */
  readonly onLoadMore?: () => void
  readonly groupByConfig?: DataTableGroupBy
  /** Whole-view record count per group value backing the group headers. */
  readonly groupCounts?: Readonly<Record<string, number>>
  /** Whole-view aggregations per group value backing the per-group summaries. */
  readonly groupAggregations?: Readonly<Record<string, SummaryAggregations>>
  readonly summaryConfig?: readonly DataTableSummaryItem[]
  /** Whole-view aggregates backing the summary footer (server-computed). */
  readonly summaryAggregations?: SummaryAggregations
  /** Column configuration — the footer reads each summarised column's `format`. */
  readonly columnConfig?: readonly DataTableColumn[]
  readonly tableFields?: readonly string[]
  readonly fieldMeta?: FieldMetaMap
  readonly globalFilter: string
  readonly setGlobalFilter: (value: string) => void
  readonly striped: boolean
  /**
   * Field whose declared option colours fill each row, plus the resolved
   * `optionValue → #RRGGBB` map — the grid's spelling of the record views'
   * `colorField`. Both absent on a grid that declares none.
   */
  readonly rowColorField?: string
  readonly rowColorFieldColors?: Readonly<Record<string, string>>
  readonly currentRowHeight: string
  /**
   * How the grid occupies its parent. `fill` turns the view's own container
   * into a column that grows into the height its bounded ancestor left it;
   * omitted (or `flow`) leaves that container exactly as it has always
   * rendered, at the natural height of its rows.
   */
  readonly layout?: DataTableLayout
  readonly cellClass: string
  readonly borderClass: string
  readonly emptyMessage: string
  /**
   * Message rendered (in an `aria-live` `role="status"` region) when a
   * client-side search reduced a NON-empty dataset to zero rows — the no-match
   * state, distinct from `emptyMessage`. A `{query}` token echoes the active
   * search. Falls back to `emptyMessage` when omitted.
   */
  readonly noMatchMessage?: string
  readonly selectedCount: number
  readonly showSearch: boolean
  readonly editingCell?: EditingCell
  readonly autoSave?: InlineAutoSave
  readonly saveError?: string
  /**
   * Set when the most recent save was REFUSED because the record changed
   * underneath it, rather than failing. Surfaced separately from
   * {@link saveError} because the two call for opposite responses: a failed
   * save should be retried, a refused one must not be.
   */
  readonly saveConflict?: string
  /** Re-issues the write that exhausted its automatic retries. */
  readonly onRetrySave?: () => void
  /** Current lifecycle of the most recent inline save. */
  readonly saveStatus?: SaveStatus
  /** Resolved save-indicator visibility + position; undefined when no auto-save. */
  readonly saveIndicator?: SaveIndicatorSettings
  /** Schema-driven row-click action (currently navigate only). */
  readonly onRowClickAction?: DataTableRowClickAction
  readonly onCellDoubleClick: (rowId: string | number, field: string, currentValue: unknown) => void
  readonly onEditSave: (newValue: unknown) => Promise<void>
  readonly onEditCancel: () => void
  /** Persists a single-gesture cell (checkbox / rating) without entering edit mode. */
  readonly onCellCommit: CellCommit
  readonly onRefresh: () => void
  /**
   * Toolbar create flow. `canCreate` gates the
   * primary "Nouvel enregistrement" button (absent — not disabled — when the
   * role may not create). `creating` drives the create modal; `onCreate` opens
   * it, `onCancelCreate` closes it, `onSubmitCreate` POSTs the filled fields.
   */
  readonly canCreate: boolean
  /**
   * Interpreter-provided create-record label, resolved server-side
   * against the active language. Labels the toolbar create button and the create
   * modal's title/aria-label so they localize to the app language.
   */
  readonly newRecordLabel: string
  /** Interpreter-provided create-dialog footer labels (same resolution). */
  readonly saveLabel: string
  readonly cancelLabel: string
  readonly creating: boolean
  readonly onCreate: () => void
  readonly onCancelCreate: () => void
  readonly onSubmitCreate: (values: Record<string, string>) => void
  /**
   * Read-only system-source grid:
   * the rows come from a read endpoint, not a DB table. When true, the
   * DB-table-only write affordances (CSV import, create) are gated OFF and the
   * grid keeps its native `<table>` role + accessible name (so a named runs
   * directory resolves via `getByRole('table', { name })`) rather than the
   * editable-grid `role="grid"` used by the record-drawer surface.
   */
  readonly readOnly?: boolean
  /**
   * System read-endpoint (`dataSource.system.endpoint`) for the CSV export. When
   * present (a read-only system source) AND `toolbar.export` is enabled, the
   * toolbar renders an "Exporter" affordance that navigates the browser to
   * `{endpoint}?format=csv` instead of the DB-table records-export dropdown.
   */
  readonly systemExportEndpoint?: string
  readonly currentDensity: RowDensity
  readonly onSelectDensity: (density: RowDensity) => void
  readonly onResetPreferences?: () => void
  readonly activeViewName?: string
  readonly onBulkExecute: (action: DataTableBulkAction) => void
  /** Realtime conflict surfaced when a concurrent edit overwrote displayed values. */
  readonly conflict?: DetectedConflict
  /** Dismisses the active realtime conflict toast. */
  readonly onDismissConflict?: () => void
  /**
   * Logical realtime transport connectivity.
   * Undefined when the data source is not in `realtime` refresh mode.
   */
  readonly connectionStatus?: RealtimeConnectionState
  readonly ui: ReturnType<typeof useDataTableUiState>
  /**
   * Saved-views surface (PG-03 / [internal ref]..022). The orchestrator
   * resolves these from `useSavedViews` + the schema's `app.tables[i].views[]`
   * and hands the merged shape down for the toolbar's Views menu + dialogs.
   */
  readonly viewsEnabled: boolean
  readonly viewEntries: ReadonlyArray<ViewsMenuEntry>
  readonly canSaveCurrentView: boolean
  readonly isViewModified: boolean
  readonly onSelectView: (entry: ViewsMenuEntry) => void
  readonly onSaveNewView: (name: string) => Promise<void>
  readonly onSaveModifiedView: () => void
  readonly onConfirmDeleteView: () => Promise<void>
  /**
   * View-type switcher config. `views` is
   * the ordered set the toolbar offers; the two per-view bindings are what the
   * non-grid views need to render, and validation guarantees each is present
   * whenever its view type is listed.
   */
  readonly views: readonly DataTableViewType[]
  readonly viewLabels?: DataTableViewLabels
  readonly kanbanGroupBy?: DataTableKanbanGroupBy
  readonly dateField?: string
}

// ---------------------------------------------------------------------------
// Region bags
// ---------------------------------------------------------------------------
//
// The view's regions follow the DOM; the hooks that feed them follow the data.
// The two do not line up — `ui` reaches three regions, and a third of the
// view's props pass through no hook at all — so `useViewProps` speaks both
// vocabularies and translates once, rather than deforming either side.

/** Alerts and indicators drawn above the toolbar. */
export interface StatusBannersProps {
  readonly showToastIndicator: boolean
  readonly indicatorStatus: SaveStatus
  readonly saveError?: string
  /** Re-issues the write that exhausted its automatic retries. */
  readonly onRetrySave?: () => void
  /**
   * Set when the most recent save was REFUSED because the record changed
   * underneath it, rather than failing. Separate from {@link saveError}
   * because the two call for opposite responses.
   */
  readonly saveConflict?: string
  readonly conflict?: DetectedConflict
  readonly onDismissConflict?: () => void
  /**
   * Realtime transport state, when the data source declares one. The
   * `data-connection-status` attribute on the container has always carried
   * this, but an attribute is invisible: a grid whose live connection is stuck
   * retrying rendered identically to a healthy one, so a reader could keep
   * working in a view that had silently stopped updating. The banner turns the
   * attribute into something a person can see.
   */
  readonly connectionStatus?: RealtimeConnectionState
}

/**
 * The record and saved-view dialogs.
 *
 * The CSV import dialog shares this bag but renders from its own component, so
 * that it keeps its position as the container's LAST child: these are
 * overlays, and reordering equal-z siblings changes which one wins.
 */
export interface ViewDialogsProps {
  readonly creating: boolean
  readonly tableFields: readonly string[]
  readonly fieldMeta?: FieldMetaMap
  readonly newRecordLabel: string
  readonly saveLabel: string
  readonly cancelLabel: string
  readonly onCancelCreate: () => void
  readonly onSubmitCreate: (values: Record<string, string>) => void
  readonly tableName: string
  readonly ui: ReturnType<typeof useDataTableUiState>
  readonly onSaveNewView: (name: string) => Promise<void>
  readonly onConfirmDeleteView: () => Promise<void>
}

/** The runtime filter-builder and multi-sort panels. */
export interface GridPanelsProps {
  readonly tableFields: readonly string[]
  readonly fieldMeta?: FieldMetaMap
  readonly ui: ReturnType<typeof useDataTableUiState>
}

/** The rows themselves — or the alternate view that replaces them — plus the footer. */
export interface GridBodyProps {
  /**
   * The grid and the alternate views are mutually exclusive: a switch REPLACES
   * the table rather than rendering a second surface beside it. Pagination
   * belongs to the grid, so it goes with it.
   */
  readonly showGrid: boolean
  /** Present only while a non-grid view type is active. */
  readonly alternate?: AlternateViewProps
  readonly grid: TableContentProps
  readonly table: DataTableInstance
  readonly totalRecords: number
  readonly paginationConfig?: DataTablePagination
  /**
   * The grid is reading a CURSOR feed, which reports no total — so the
   * numbered pager yields to the continuation rather than inventing one.
   */
  readonly cursorPaged: boolean
  readonly hasMore: boolean
  /**
   * A continuation is in flight, OR a typed term has not yet reached the grid.
   * The second case matters as much as the first: during the debounce window
   * everything on screen answers the previous question, so continuing the feed
   * then appends a page of UNFILTERED rows that the landing term discards.
   */
  readonly isLoadingMore: boolean
  readonly onLoadMore?: () => void
}

/** Everything below the dialogs: the bulk-action bar, the panels, the rows. */
export interface TableSurfaceProps {
  readonly bulkActionsConfig?: readonly DataTableBulkAction[]
  readonly selectedCount: number
  readonly onBulkExecute: (action: DataTableBulkAction) => void
  /** The whole data region is suppressed while the import dialog is open. */
  readonly importDialogOpen: boolean
  readonly filterOverlayOpen: boolean
  readonly sortOverlayOpen: boolean
  readonly panels: GridPanelsProps
  readonly body: GridBodyProps
}

/** What {@link useViewProps} resolves the island's flat props into. */
export interface ViewRegions {
  readonly banners: StatusBannersProps
  readonly toolbar: DataTableToolbarBarProps
  readonly dialogs: ViewDialogsProps
  readonly surface: TableSurfaceProps
}
