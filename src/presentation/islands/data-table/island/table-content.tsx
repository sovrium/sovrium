/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useRef } from 'react'
import { TableBodyRows, TableHeader, TableSummaryFooter } from '../body'
import { resolvePageLocale } from '../formatting'
import { useFrozenOffsets } from '../frozen-columns'
import type { EditingCell, FieldMetaMap, SaveStatus } from '../../hooks/use-inline-editing'
import type { TableRecord } from '../../shared/types'
import type { CellCommit, DataTableRowClickAction, InlineAutoSave } from '../body'
import type { GroupSummaryContext } from '../group-summary'
import type { SummaryAggregations } from '../summary-aggregate'
import type {
  DataTableColumn,
  DataTableGroupBy,
  DataTableSummaryItem,
} from '@/domain/models/app/pages/components/component-types/data/data-table/schema'
import type { Column, ColumnDef, useReactTable } from '@tanstack/react-table'

interface TableContentProps {
  readonly table: ReturnType<typeof useReactTable<TableRecord>>
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
  readonly allColumns: readonly ColumnDef<TableRecord>[]
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
}

/**
 * The `<table>` body of the data-table island: header + rows + (optional)
 * summary footer. Extracted from the orchestrator to keep its statement
 * count under the size-limits cap; renders unchanged from the inline form.
 */
/**
 * Resolve the table's ARIA semantics.
 *
 * `role="grid"` + `aria-label` are applied ONLY when an accessible name is
 * supplied (the dashboard record-drawer surface,
 * [internal ref]) so `getByRole('grid', { name })`
 * / `getByRole('gridcell')` resolve there, AND the grid is not a read-only
 * system-source directory (`useGridRole !== false`). A read-only directory and
 * an unnamed table keep the native `<table>` / `cell` ARIA semantics —
 * preserving every existing data-table spec that targets `getByRole('cell', …)`.
 */
function resolveTableAria(
  ariaLabel: string | undefined,
  useGridRole: boolean | undefined
): { readonly hasAriaLabel: boolean; readonly gridRole: boolean } {
  const hasAriaLabel = ariaLabel !== undefined && ariaLabel.length > 0
  return { hasAriaLabel, gridRole: hasAriaLabel && useGridRole !== false }
}

/**
 * The field name a visible leaf column stands for — the grid the summary footer
 * aligns against. Falls back to the column id for the generated columns
 * (selection checkbox, row number, action cluster), which no summary can name.
 */
const columnFieldName = (column: Column<TableRecord, unknown>): string =>
  (column.columnDef.meta as { field?: string } | undefined)?.field ?? column.id

/** Whether the author pinned this column (`columns[].frozen`). */
const isFrozenColumn = (column: Column<TableRecord, unknown>): boolean =>
  (column.columnDef.meta as { frozen?: boolean } | undefined)?.frozen === true

/**
 * The `<table>` ref and the measured sticky offsets its pinned (`frozen`)
 * columns need. Both the header and the body cells read the SAME offsets, which
 * is what keeps a frozen column reading as one column under horizontal scroll.
 */
function useFrozenPinning(table: TableContentProps['table']) {
  const tableRef = useRef<HTMLTableElement>(null)
  // In column order — the order the offsets stack in.
  const frozenFields = table.getVisibleLeafColumns().filter(isFrozenColumn).map(columnFieldName)
  return { tableRef, frozenOffsets: useFrozenOffsets(tableRef, frozenFields) }
}

/**
 * The whole-view summary footer, or nothing when no column is summarised.
 *
 * Its own component so `TableContent` stays a layout shell: the footer needs
 * five values off `props` plus the table's visible leaf columns, and inlining
 * that conditional put a second concern inside the element that positions the
 * grid.
 */
function SummaryFooterSlot({
  props,
  cellClass,
}: {
  readonly props: TableContentProps
  readonly cellClass: string
}) {
  const { summaryConfig, table } = props
  if (!summaryConfig || summaryConfig.length === 0) return undefined
  return (
    <TableSummaryFooter
      summary={summaryConfig}
      aggregations={props.summaryAggregations}
      columnFields={table.getVisibleLeafColumns().map(columnFieldName)}
      columns={props.columnConfig}
      fieldMeta={props.fieldMeta}
      locale={resolvePageLocale()}
      cellClass={cellClass}
    />
  )
}

/**
 * The per-group summary context, or nothing when the grid is not both grouped
 * and summarised. Built from exactly the values the footer uses — same items,
 * same columns, same locale — so the two scopes cannot drift apart in format.
 */
function resolveGroupSummary(props: TableContentProps): GroupSummaryContext | undefined {
  const { groupByConfig, summaryConfig, groupAggregations, table } = props
  if (!groupByConfig || !summaryConfig || summaryConfig.length === 0) return undefined
  return {
    items: summaryConfig,
    byGroup: groupAggregations ?? {},
    columnFields: table.getVisibleLeafColumns().map(columnFieldName),
    columns: props.columnConfig,
    fieldMeta: props.fieldMeta,
    locale: resolvePageLocale(),
  }
}

export function TableContent(props: TableContentProps) {
  const { table, striped, currentRowHeight, cellClass, groupByConfig } = props
  const groupSummary = resolveGroupSummary(props)
  const { hasAriaLabel, gridRole } = resolveTableAria(props.ariaLabel, props.useGridRole)
  const { tableRef, frozenOffsets } = useFrozenPinning(table)
  return (
    <div className="overflow-x-auto">
      <table
        ref={tableRef}
        {...(gridRole && { role: 'grid' })}
        {...(hasAriaLabel && { 'aria-label': props.ariaLabel })}
        className="divide-border min-w-full divide-y"
        data-striped={String(striped)}
        data-row-height={currentRowHeight}
      >
        {/* prettier-ignore */}
        <TableHeader headerGroups={table.getHeaderGroups()} cellClass={cellClass} frozenOffsets={frozenOffsets} />
        <TableBodyRows
          rows={table.getRowModel().rows}
          allColumns={props.allColumns}
          isLoading={props.isLoading}
          cellClass={cellClass}
          borderClass={props.borderClass}
          striped={striped}
          rowColorField={props.rowColorField}
          rowColorFieldColors={props.rowColorFieldColors}
          emptyMessage={props.emptyMessage}
          {...(props.noMatchMessage !== undefined && { noMatchMessage: props.noMatchMessage })}
          globalFilter={props.globalFilter}
          selectionMode={props.selectionMode}
          gridRole={gridRole}
          {...(groupByConfig && { groupBy: groupByConfig })}
          {...(props.groupCounts && { groupCounts: props.groupCounts })}
          groupSummary={groupSummary}
          editingCell={props.editingCell}
          fieldMeta={props.fieldMeta}
          tableName={props.tableName}
          autoSave={props.autoSave}
          inlineSaveStatus={props.inlineSaveStatus}
          onRowClickAction={props.onRowClickAction}
          onCellDoubleClick={props.onCellDoubleClick}
          onEditSave={props.onEditSave}
          onEditCancel={props.onEditCancel}
          onCellCommit={props.onCellCommit}
          frozenOffsets={frozenOffsets}
          {...(props.collapsedGroups && { collapsedGroups: props.collapsedGroups })}
          {...(props.onToggleGroupCollapsed && {
            onToggleGroupCollapsed: props.onToggleGroupCollapsed,
          })}
        />
        <SummaryFooterSlot
          props={props}
          cellClass={cellClass}
        />
      </table>
    </div>
  )
}
