/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { EditingCell, FieldMetaMap, SaveStatus } from '../../hooks/use-inline-editing'
import type { CellCommit, DataTableRowClickAction, InlineAutoSave } from '../body'
import type { SummaryAggregations } from '../summary-aggregate'
import type { DataTableColumnDef, DataTableInstance } from './table-features'
import type {
  DataTableColumn,
  DataTableGroupBy,
  DataTableLayout,
  DataTableSummaryItem,
} from '@/domain/models/app/pages/components/component-types/data/table/schema'

export interface TableContentProps {
  readonly table: DataTableInstance
  /** Accessible name applied to the table (optional). */
  readonly ariaLabel?: string
  /**
   * Whether to apply the editable-grid `role="grid"` ARIA semantics when an
   * `ariaLabel` is present (default true). The record-drawer surface keeps
   * `role="grid"` so `getByRole('grid'/'gridcell', { name })` resolves. A
   * read-only system-source directory passes `false` so the table keeps its
   * NATIVE `<table>` role + accessible name — letting a named runs directory
   * resolve via `getByRole('table', { name })`.
   */
  readonly useGridRole?: boolean
  readonly allColumns: readonly DataTableColumnDef[]
  readonly isLoading: boolean
  readonly striped: boolean
  /**
   * Field whose declared option colours fill each row, plus the resolved
   * `optionValue → #RRGGBB` map. A filled row suppresses its stripe and moves
   * hover/selection off the fill; an unfilled one is untouched.
   */
  readonly rowColorField?: string
  readonly rowColorFieldColors?: Readonly<Record<string, string>>
  readonly currentRowHeight: string
  /**
   * How the grid occupies its parent. `fill` is what gives THIS region the
   * vertical scroll — it already owns the horizontal one — and what pins the
   * column heads to it. Omitted (or `flow`) leaves both exactly as they have
   * always rendered: the region takes the height of its rows and scrolls
   * sideways only.
   */
  readonly layout?: DataTableLayout
  readonly cellClass: string
  readonly borderClass: string
  readonly emptyMessage: string
  /**
   * Message rendered (in an `aria-live` `role="status"` region) when a search
   * reduced the grid to zero rows — the no-match state, distinct from
   * `emptyMessage`. A `{query}` token echoes the active search. Falls back to
   * `emptyMessage` when omitted.
   */
  readonly noMatchMessage?: string
  /** Active search string (TanStack `globalFilter`); echoed by `noMatchMessage`. */
  readonly globalFilter?: string
  readonly selectionMode?: 'none' | 'single' | 'multiple'
  readonly groupByConfig?: DataTableGroupBy
  /**
   * Whole-view record count per group PATH (`?groupBy=`), computed over the same
   * filtered table the page is drawn from — so a group header's number describes
   * the view and stays put when the reader turns a page, exactly as the summary
   * footer's numbers already do, and at every nested level rather than the first.
   */
  readonly groupCounts?: Readonly<Record<string, number>>
  /**
   * Whole-view aggregations per group PATH. A declared `summary` describes the
   * grid as a whole AND, once grouped, each group at every level — so the same
   * items the footer renders are answered here per group, from the same response.
   */
  readonly groupAggregations?: Readonly<Record<string, SummaryAggregations>>
  readonly summaryConfig?: readonly DataTableSummaryItem[]
  /**
   * Whole-view aggregates for the summary footer, computed server-side. The
   * footer used to reduce the CURRENT PAGE's records, so every number described
   * the page rather than the view.
   */
  readonly summaryAggregations?: SummaryAggregations
  /** Column configuration — consulted for each summarised column's `format`. */
  readonly columnConfig?: readonly DataTableColumn[]
  readonly editingCell?: EditingCell
  readonly fieldMeta?: FieldMetaMap
  readonly tableName: string
  readonly autoSave?: InlineAutoSave
  /**
   * When set, the save status indicator renders inline inside the edited cell.
   * Only supplied when `saveIndicatorPosition` is `inline`.
   */
  readonly inlineSaveStatus?: SaveStatus
  /** Schema-driven action fired on row click — currently navigate only. */
  readonly onRowClickAction?: DataTableRowClickAction
  readonly onCellDoubleClick: (rowId: string | number, field: string, currentValue: unknown) => void
  readonly onEditSave: (newValue: unknown) => Promise<void>
  readonly onEditCancel: () => void
  /** Persists a single-gesture cell (checkbox / rating) without entering edit mode. */
  readonly onCellCommit: CellCommit
  /**
   * Group paths flipped away from their level's declared fold state
   *. Forwarded to the body's grouped-rendering branch.
   */
  readonly collapsedGroups?: ReadonlyArray<string>
  /** Toggles a group's fold state by its path key. */
  readonly onToggleGroupCollapsed?: (pathKey: string) => void
  /**
   * Whether the current role may create records in the bound table — the
   * gate the trailing add-row shares with the toolbar's create button. False
   * (or absent) renders no trailing row at all.
   */
  readonly canCreate?: boolean
  /** Re-reads the grid after the add-row created a record. */
  readonly onRecordCreated?: () => void
}
