/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useMemo, type RefObject } from 'react'
import {
  computeTableElementClasses,
  computeTableFillScrollClasses,
} from '@/presentation/design/table-default-classes'
import { resolvePageLocale } from '../../runtime/page-locale'
import { TableBodyRows, TableHeader, TableSummaryFooter } from '../body'
import { resolveEditableFields } from './island-setup-helpers'
import { resolveTabTarget } from './tab-target'
import { resolveAddRow } from './table-add-row-columns'
import { columnFieldName, useFrozenPinning } from './table-frozen-columns'
import { canFillFrom, useFillHandle } from './use-fill-handle'
import { useGridCursor } from './use-grid-cursor'
import { WARNING_STRIP_CLASS } from './warning-strip'
import type { EditingCell, FieldMetaMap } from '../../hooks/use-inline-editing'
import type { AddRowConfig } from '../add-row'
import type { InlineAutoSave } from '../body'
import type { GroupSummaryContext } from '../group-summary'
import type { TableContentProps } from './table-content-types'
import type { DataTableCell, DataTableGridColumn, DataTableRow } from './table-features'
import type {
  DataTableColumn,
  DataTableGroupBy,
} from '@/domain/models/app/pages/components/component-types/data/table/schema'

export type { TableContentProps } from './table-content-types'

/**
 * The `<table>` body of the data-table island: header + rows + (optional)
 * summary footer. Extracted from the orchestrator to keep its statement
 * count under the size-limits cap; renders unchanged from the inline form.
 */
/**
 * Resolve the table's ARIA semantics.
 *
 * A table is a GRID when it is an interactive widget — when the author
 * declared a column editable, so the keyboard moves a cell cursor through it
 * — or when it was given an accessible name (the dashboard record-drawer
 * surface, which relies on `getByRole('grid', { name })`). Either way a
 * read-only system-source directory opts out with `useGridRole: false` and
 * keeps the native `<table>` role plus its accessible name.
 *
 * The name alone used to be the whole test, which asked the wrong question:
 * having an accessible name says nothing about being an interactive widget,
 * so the commonest shape of all — an editable grid nobody named — announced
 * itself as a static table. `aria-label` is still emitted on exactly the same
 * condition as before; only the ROLE widened.
 *
 * A `<td>` inside a `role="grid"` computes as `gridcell`, and the table itself
 * no longer answers to `table`. The surfaces that looked a cell up by its
 * native role were moved onto the `data-*` attributes the grid already emits,
 * which is what let the role widen without them going blind. Gating on the
 * AUTHORED `editable: true` rather than the permission-derived default keeps
 * every grid that merely permits updates reporting its native roles.
 */
function resolveTableAria(
  ariaLabel: string | undefined,
  useGridRole: boolean | undefined,
  navigable: boolean
): { readonly hasAriaLabel: boolean; readonly gridRole: boolean } {
  const hasAriaLabel = ariaLabel !== undefined && ariaLabel.length > 0
  return { hasAriaLabel, gridRole: (hasAriaLabel || navigable) && useGridRole !== false }
}

/**
 * Whether this grid answers the keyboard with a cell CURSOR: the author
 * declared at least one column editable, and it is not a read-only
 * system-source directory.
 *
 * `role="grid"` used to require a configured `ariaLabel`, which is the wrong
 * question: having an accessible NAME says nothing about being an interactive
 * widget, so the commonest shape of all — an editable grid nobody named —
 * announced itself as a static table and got no cell cursor.
 *
 * It reads the authored `columns[]`, NOT the resolved column meta, and the
 * distinction is the whole reason this function exists rather than being one
 * line at the call site. `editable` defaults "from table permissions", so the
 * RESOLVED flag is true for any grid whose table merely permits updates —
 * which is most of them. Keying on it turned tables into grids wholesale, and
 * `role="grid"` makes every `<td>` compute as `gridcell` rather than `cell`:
 * two shipped specs went looking for `getByRole('cell')` and `getByRole('table')`
 * and found neither. An explicit `editable: true` is a statement that this
 * grid is for editing in; a permission is not.
 */
const isNavigableGrid = (
  columns: readonly DataTableColumn[] | undefined,
  useGridRole: boolean | undefined
): boolean =>
  useGridRole !== false &&
  // `in` rather than a property read: an action column is part of the same
  // union and carries no `editable` at all.
  columns?.some((column) => 'editable' in column && column.editable === true) === true

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
 * The edit handlers, wrapped so that leaving an editor leaves the CURSOR
 * somewhere sensible.
 *
 * Enter commits and drops the cursor one row, ready for the next value in the
 * same column; Escape cancels and leaves it exactly where the reader left it.
 * Both used to end with focus on `document.body`, so the next keystroke
 * scrolled the document instead of moving the cursor — which is what made
 * typing a column of twelve values cost twelve mouse clicks.
 */
function useCursorAwareEditHandlers(
  onEditSave: (newValue: unknown) => Promise<void>,
  onEditCancel: () => void,
  cursor: ReturnType<typeof useGridCursor>,
  editingCell: EditingCell | undefined
) {
  const { advanceCursorRow, returnFocusToCursor } = cursor
  const editingRowId = editingCell === undefined ? undefined : String(editingCell.rowId)
  const handleEditSave = useCallback(
    async (newValue: unknown): Promise<void> => {
      // The cursor moves FIRST, before the write is awaited.
      //
      // Waiting for the round trip would make every Enter cost a network
      // latency before the next cell could be typed into — which is the whole
      // gesture this exists to make fast, and on a slow link it reads as the
      // grid having ignored the keystroke. The write still happens, and still
      // reports its own failure through the save indicator and the error
      // banner; what does not happen is the cursor holding still while it
      // completes.
      //
      // Anchored on the row being EDITED, not on the current cursor, so the
      // move is idempotent — see `advanceCursorRow`.
      if (editingRowId !== undefined) advanceCursorRow(editingRowId)
      await onEditSave(newValue)
    },
    [onEditSave, advanceCursorRow, editingRowId]
  )
  const handleEditCancel = useCallback((): void => {
    onEditCancel()
    returnFocusToCursor()
  }, [onEditCancel, returnFocusToCursor])
  return { handleEditSave, handleEditCancel }
}

/**
 * The Tab wiring, wrapped so the CURSOR moves to the destination cell the
 * moment Tab is pressed.
 *
 * The editor itself follows only once the commit has landed (see
 * `use-inline-save-wiring.ts`), which is right for the editor — opening one
 * over a value that has not been written yet is how a Tab-then-Escape loses a
 * keystroke — but wrong for focus: until the round trip returns, focus would
 * sit in the editor of the cell the reader has just LEFT, and a reader who
 * types straight on lands their keystrokes in the old cell. Moving the cursor
 * first is the same decision Enter makes in {@link useCursorAwareEditHandlers}.
 *
 * The destination is resolved with the SAME `resolveTabTarget` the wiring
 * uses, so the cursor and the editor cannot disagree about where Tab went.
 */
function useCursorAwareTabNext(
  autoSave: InlineAutoSave | undefined,
  cursor: ReturnType<typeof useGridCursor>,
  columnConfig: readonly DataTableColumn[] | undefined,
  leafColumns: readonly DataTableGridColumn[]
): InlineAutoSave | undefined {
  const { moveCursorTo, rowIds } = cursor
  const editableFields = useMemo(() => resolveEditableFields(columnConfig), [columnConfig])
  return useMemo(() => {
    if (autoSave === undefined) return undefined
    const onTabNext: InlineAutoSave['onTabNext'] = (rowId, currentField, newValue, direction) => {
      const target = resolveTabTarget({
        rowIds,
        editableFields,
        from: { rowId: String(rowId), field: currentField },
        direction,
      })
      const column = leafColumns.find(
        (candidate) => candidate.columnDef.meta?.field === target?.field
      )
      if (target !== undefined && column !== undefined) {
        moveCursorTo({ rowId: target.rowId, columnId: column.id })
      }
      autoSave.onTabNext(rowId, currentField, newValue, direction)
    }
    return { ...autoSave, onTabNext }
  }, [autoSave, rowIds, editableFields, leafColumns, moveCursorTo])
}

/**
 * The `<table>` element's ARIA and keyboard attributes.
 *
 * A read-only table gets none of them and renders exactly as it always has —
 * which is what keeps `role="grid"` from spreading to surfaces that are not
 * interactive widgets.
 */
function gridAttributes(params: {
  readonly gridRole: boolean
  readonly navigable: boolean
  readonly hasAriaLabel: boolean
  readonly ariaLabel: string | undefined
  readonly rows: readonly DataTableRow[]
  readonly cursor: ReturnType<typeof useGridCursor>
}): Record<string, unknown> {
  const { gridRole, navigable, hasAriaLabel, ariaLabel, rows, cursor } = params
  return {
    ...(gridRole && { role: 'grid' }),
    ...(hasAriaLabel && { 'aria-label': ariaLabel }),
    // `aria-rowcount` is a grid property, so it rides with the grid ROLE. The
    // header row counts: it describes the whole grid, and a screen reader
    // announces the header as row 1.
    ...(gridRole && { 'aria-rowcount': rows.length + 1 }),
    // The listeners ride with NAVIGABILITY. `data-navigable` is what the
    // DOM-driven clipboard hook reads to know the cursor owns Shift-selection.
    ...(navigable && {
      'data-navigable': 'true',
      onKeyDown: cursor.handleKeyDown,
      onMouseDown: cursor.handleMouseDown,
      onFocus: cursor.handleFocus,
    }),
  }
}

/**
 * The display name a column goes by in a message to the reader — the authored
 * `label`, else the field's declared label, else the field name itself.
 */
function columnLabelResolver(
  columnConfig: readonly DataTableColumn[] | undefined,
  fieldMeta: FieldMetaMap | undefined
): (field: string) => string {
  return (field) => {
    const authored = columnConfig?.find(
      (column): column is Extract<DataTableColumn, { field: string }> =>
        'field' in column && column.field === field
    )
    return authored?.label ?? fieldMeta?.[field]?.label ?? field
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
  readonly groupByConfig: DataTableGroupBy | undefined
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
 * The cursor, the fill handle and the cursor-aware edit handlers of one grid,
 * all of which hang off the same `<table>` ref and the same row model.
 */
function useGridInteractions(
  props: TableContentProps,
  tableRef: RefObject<HTMLTableElement | null>,
  navigable: boolean
) {
  const { table, fieldMeta } = props
  const { rows } = table.getRowModel()
  const leafColumns = table.getVisibleLeafColumns()
  const labelOf = columnLabelResolver(props.columnConfig, fieldMeta)
  // prettier-ignore
  const cursor = useGridCursor({ tableRef, enabled: navigable, rows, leafColumns, editingCell: props.editingCell })
  // prettier-ignore
  const fill = useFillHandle({ enabled: navigable, rows, leafColumns, rowIds: cursor.rowIds, columnIds: cursor.columnIds, fieldMeta, labelOf, onCellCommit: props.onCellCommit })
  const addRow = resolveAddRow(props, leafColumns, labelOf)
  const canFillFromCell = useCallback(
    (cell: DataTableCell): boolean => canFillFrom(cell.column, fieldMeta),
    [fieldMeta]
  )
  const editHandlers = useCursorAwareEditHandlers(
    props.onEditSave,
    props.onEditCancel,
    cursor,
    props.editingCell
  )
  const autoSave = useCursorAwareTabNext(props.autoSave, cursor, props.columnConfig, leafColumns)
  return { rows, cursor, fill, canFillFromCell, autoSave, addRow, ...editHandlers }
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
