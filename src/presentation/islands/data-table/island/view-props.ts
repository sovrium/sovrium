/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { SelectionExportProps } from './selection-export'
import type { TableContentProps } from './table-content'
import type { DataTableColumnDef, DataTableInstance } from './table-features'
import type { SaveIndicatorSettings } from './use-island-setup'
import type { useDataTableUiState } from './use-ui-state'
import type { EditingCell, FieldMetaMap, SaveStatus } from '../../hooks/use-inline-editing'
import type { DetectedConflict } from '../../hooks/use-realtime-reconciliation'
import type { RealtimeConnectionState } from '../../hooks/use-realtime-subscription'
import type { CellCommit, DataTableRowClickAction, InlineAutoSave } from '../data-row-types'
import type { SummaryAggregations } from '../summary-aggregate'
import type { SessionControlsProps } from '../view-options/session-controls'
import type {
  DataTableBulkAction,
  DataTableColumn,
  DataTableLayout,
  DataTablePagination,
  DataTableSelection,
  DataTableSummaryItem,
} from '@/domain/models/app/pages/components/component-types/data/table/schema'
import type { ViewGroupBy } from '@/domain/models/app/tables/views/group-by'

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
  /**
   * The rows have no answer to count: still being read, or the read failed
   * before any row arrived. The pager then states no total at all.
   */
  readonly unanswered?: boolean
  readonly selectionConfig?: DataTableSelection
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
  readonly groupByConfig?: ViewGroupBy
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
  /** The grid listens to a channel the page's controls publish on. */
  readonly subscribed: boolean
  /** A control on the page narrows the grid: its result count is announced. */
  readonly narrowed: boolean
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
  /** `rows` draws each row as a two-line item below the `sm` breakpoint. */
  readonly phoneLayout?: 'scroll' | 'rows'
  /** Where the reader's view options sit; `toolbar` draws one View menu above the rows. */
  readonly viewOptions?: 'bottom-bar' | 'toolbar'
  /** The channel the grid listens on, which names the toolbar the View menu joins. */
  readonly viewChannel?: string
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
   * The reader may add a row: the server did not deny create for their role
   * and the grid is bound to a table it can write to. Gates the trailing
   * add-row line.
   */
  readonly canCreate: boolean
  /**
   * The reader may delete the table's records (decided on the server, like
   * {@link canCreate}): the selection then offers Delete.
   */
  readonly canDelete: boolean
  /**
   * The grid reads through a table VIEW. The export route is the table's,
   * gated on the table's own read grant — which a visitor on a public view does
   * not hold — so the selection export is not offered.
   */
  readonly isViewBound: boolean
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
   * System read-endpoint (`dataSource.system.endpoint`). Its presence tells
   * the selection export there is no DB table to route a selection through, so
   * it serialises the rows the grid already holds.
   */
  readonly systemExportEndpoint?: string
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
}

// ---------------------------------------------------------------------------
// Region bags
// ---------------------------------------------------------------------------
//
// The view's regions follow the DOM; the hooks that feed them follow the data.
// The two do not line up — `ui` reaches three regions, and a third of the
// view's props pass through no hook at all — so `useViewProps` speaks both
// vocabularies and translates once, rather than deforming either side.

/** Alerts and indicators drawn above the grid. */
export interface StatusBannersProps {
  /** The save status shown in its own row (`saveIndicatorPosition: toolbar`). */
  readonly toolbarSaveStatus?: SaveStatus
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

/** The rows themselves, plus the footer. */
export interface GridBodyProps {
  readonly grid: TableContentProps
  readonly phoneLayout?: 'scroll' | 'rows'
  readonly table: DataTableInstance
  readonly totalRecords: number
  /** The rows have no answer to count yet — see `DataTableViewProps.unanswered`. */
  readonly unanswered: boolean
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
  /**
   * What acts on the checked rows, on a grid whose rows can be checked: drawn in
   * the bottom bar's left half once anything is checked. Its presence alone
   * draws the bottom bar on a grid that numbers no pages.
   */
  readonly selection?: GridSelection
  /** The reader's Group by · Hide fields · Row height, in the bottom bar. */
  readonly session: SessionControlsProps
  /** `toolbar`: the session controls are one View menu above the rows, not in the bottom bar. */
  readonly viewOptions?: 'bottom-bar' | 'toolbar'
  readonly viewChannel?: string
}

/** The selection's half of the bottom bar. */
export interface GridSelection {
  readonly bulkActions: readonly DataTableBulkAction[]
  readonly selectedCount: number
  readonly onExecute: (action: DataTableBulkAction) => void
  /** The selection export the bar offers, absent when the grid offers none. */
  readonly selectionExport?: SelectionExportProps
  /** The table Delete removes rows from; absent when the reader may not delete. */
  readonly deleteFrom?: string
}

/** Everything below the banners: the rows and the bars that frame them. */
export interface TableSurfaceProps {
  /** The author's bulk actions, kept in the DOM hidden while nothing is checked. */
  readonly bulkActionsConfig?: readonly DataTableBulkAction[]
  readonly body: GridBodyProps
}

/** What {@link useViewProps} resolves the island's flat props into. */
export interface ViewRegions {
  readonly banners: StatusBannersProps
  readonly surface: TableSurfaceProps
}
