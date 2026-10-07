/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeTableElementClasses,
  computeTableFillScrollClasses,
} from '@/presentation/design/table-default-classes'
import { resolvePageLocale } from '../../runtime/page-locale'
import { TableBodyRows, TableHeader, TableSummaryFooter } from '../body'
import { columnFieldName, useFrozenPinning } from './table-frozen-columns'
import {
  resolveTableAria,
  isNavigableGrid,
  gridAttributes,
  useGridInteractions,
} from './use-grid-interactions'
import { WARNING_STRIP_CLASS } from './warning-strip'
import type { useFillHandle } from './use-fill-handle'
import type { useGridCursor } from './use-grid-cursor'
import type { AddRowConfig } from '../add-row'
import type { InlineAutoSave } from '../body'
import type { GroupSummaryContext } from '../group-summary'
import type { TableContentProps } from './table-content-types'
import type { DataTableCell, DataTableRow } from './table-features'
import type { ViewGroupBy } from '@/domain/models/app/tables/views/group-by'

export type { TableContentProps } from './table-content-types'

/**
 * The whole-view summary footer, or nothing when no column is summarised.
 *
 * Its own component so `TableContent` stays a layout shell: the footer needs
 * five values off `props` plus the table's visible leaf columns, and inlining
 * that conditional put a second concern inside the element that positions the
 * grid.
 */
function SummaryFooterSlot({ props }: { readonly props: TableContentProps }) {
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

/**
 * What a fill could not write, named so the reader can act on it.
 *
 * `role="status"` rather than `alert`: the fill that could land did, and the
 * reader is being told which column was left as it was — a change of
 * condition, not an emergency. Dismissable, and cleared by the next fill.
 */
function FillRefusals({
  refusals,
  onDismiss,
}: {
  readonly refusals: readonly string[]
  readonly onDismiss: () => void
}) {
  if (refusals.length === 0) return undefined
  return (
    <div
      role="status"
      data-fill-refusal="true"
      className={`${WARNING_STRIP_CLASS} flex items-start justify-between gap-4`}
    >
      <div>
        {refusals.map((reason) => (
          <p key={reason}>{reason} — that column was left unchanged.</p>
        ))}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="hover:bg-background-subtle rounded px-2 font-medium"
      >
        Dismiss
      </button>
    </div>
  )
}

/**
 * The body rows, as their own component for the same reason
 * {@link SummaryFooterSlot} is one: `TableContent` positions the grid, and a
 * twenty-prop forwarding list inside it buries that job.
 */
/** The fill-handle wiring the body rows receive — nothing at all on a grid that cannot fill. */
function fillProps(
  fill: ReturnType<typeof useFillHandle>,
  canFillFromCell: (cell: DataTableCell) => boolean,
  addRow: AddRowConfig | undefined
): Pick<
  Parameters<typeof TableBodyRows>[0],
  'fillPreview' | 'onFillDragStart' | 'onFillDown' | 'canFillFrom' | 'addRow'
> {
  const rowProps = addRow === undefined ? {} : { addRow }
  if (!fill.enabled) return rowProps
  return {
    ...rowProps,
    fillPreview: fill.preview,
    onFillDragStart: fill.startDrag,
    onFillDown: fill.fillDown,
    canFillFrom: canFillFromCell,
  }
}

interface BodyRowsSlotProps {
  readonly props: TableContentProps
  readonly rows: readonly DataTableRow[]
  readonly gridRole: boolean
  readonly navigable: boolean
  readonly cursor: ReturnType<typeof useGridCursor>
  readonly fill: ReturnType<typeof useFillHandle>
  readonly canFillFromCell: (cell: DataTableCell) => boolean
  /** The save wiring, with Tab made cursor-aware — see {@link useCursorAwareTabNext}. */
  readonly autoSave: InlineAutoSave | undefined
  readonly addRow: AddRowConfig | undefined
  readonly cellClass: string
  readonly striped: boolean
  readonly groupByConfig: ViewGroupBy | undefined
  readonly groupSummary: GroupSummaryContext | undefined
  readonly frozenOffsets: ReturnType<typeof useFrozenPinning>['frozenOffsets']
  readonly onEditSave: (newValue: unknown) => Promise<void>
  readonly onEditCancel: () => void
}

function BodyRowsSlot({
  props,
  rows,
  gridRole,
  navigable,
  cursor,
  fill,
  canFillFromCell,
  autoSave,
  addRow,
  cellClass,
  striped,
  groupByConfig,
  groupSummary,
  frozenOffsets,
  onEditSave,
  onEditCancel,
}: BodyRowsSlotProps) {
  return (
    <TableBodyRows
      {...fillProps(fill, canFillFromCell, addRow)}
      range={cursor.range}
      rows={rows}
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
      navigable={navigable}
      cursorRowId={cursor.cursorRowId}
      cursorPlaced={cursor.cursorPlaced}
      cursorColumnId={cursor.cursorColumnId}
      {...(groupByConfig && { groupBy: groupByConfig })}
      {...(props.groupCounts && { groupCounts: props.groupCounts })}
      groupSummary={groupSummary}
      editingCell={props.editingCell}
      fieldMeta={props.fieldMeta}
      tableName={props.tableName}
      autoSave={autoSave}
      inlineSaveStatus={props.inlineSaveStatus}
      onRowClickAction={props.onRowClickAction}
      onCellDoubleClick={props.onCellDoubleClick}
      onEditSave={onEditSave}
      onEditCancel={onEditCancel}
      onCellCommit={props.onCellCommit}
      frozenOffsets={frozenOffsets}
      {...(props.collapsedGroups && { collapsedGroups: props.collapsedGroups })}
      {...(props.onToggleGroupCollapsed && {
        onToggleGroupCollapsed: props.onToggleGroupCollapsed,
      })}
    />
  )
}

/**
 * The grid's scroll region and the `<table>` inside it.
 *
 * Under `layout: fill` the outer `div` takes the VERTICAL overflow as well as
 * the horizontal one it already had, which is what makes it the box the rows
 * move inside — and therefore the box the column heads pin to. The two travel
 * together for that reason: a head pinned to a box that owns no scroll pins to
 * nothing.
 *
 * It is also the box the fill FLOOR is about, which is why the density the rows
 * are drawn at travels with it: the floor is the pinned header plus three rows
 * of exactly this height, so a reader whose column has over-subscribed keeps a
 * grid instead of a seam.
 */
export function TableContent(props: TableContentProps) {
  const { table, striped, currentRowHeight, cellClass, groupByConfig } = props
  const groupSummary = resolveGroupSummary(props)
  const navigable = isNavigableGrid(props.columnConfig, props.useGridRole)
  const { hasAriaLabel, gridRole } = resolveTableAria(props.ariaLabel, props.useGridRole, navigable)
  const { tableRef, frozenOffsets } = useFrozenPinning(table)
  // prettier-ignore
  const { rows, cursor, fill, canFillFromCell, autoSave, addRow, handleEditSave, handleEditCancel } = useGridInteractions(props, tableRef, navigable)
  const fills = props.layout === 'fill'
  const fillScroll = fills
    ? ` ${computeTableFillScrollClasses({ rowHeight: currentRowHeight })}`
    : ''

  return (
    <div className={`overflow-x-auto${fillScroll}`}>
      <FillRefusals
        refusals={fill.refusals}
        onDismiss={fill.dismissRefusals}
      />
      <table
        ref={tableRef}
        {...gridAttributes({
          gridRole,
          navigable,
          hasAriaLabel,
          ariaLabel: props.ariaLabel,
          rows,
          cursor,
        })}
        className={`divide-border divide-y ${computeTableElementClasses()}`}
        data-striped={String(striped)}
        data-row-height={currentRowHeight}
      >
        {/* prettier-ignore */}
        <TableHeader headerGroups={table.getHeaderGroups()} frozenOffsets={frozenOffsets} sticky={fills} />
        <BodyRowsSlot
          props={props}
          rows={rows}
          gridRole={gridRole}
          navigable={navigable}
          cursor={cursor}
          fill={fill}
          canFillFromCell={canFillFromCell}
          autoSave={autoSave}
          addRow={addRow}
          cellClass={cellClass}
          striped={striped}
          groupByConfig={groupByConfig}
          groupSummary={groupSummary}
          frozenOffsets={frozenOffsets}
          onEditSave={handleEditSave}
          onEditCancel={handleEditCancel}
        />
        <SummaryFooterSlot props={props} />
      </table>
    </div>
  )
}
