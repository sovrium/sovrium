/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ColumnDef } from '@tanstack/react-table'
import { stopClickPropagation } from '../cell-click'
import {
  autoGenerateColumns,
  autoGenerateColumnsFromFields,
  mapColumnsToColumnDefs,
  resolvePageLocale,
  type RowActionHandler,
} from '../formatting'
import type { FieldMetaMap } from '../../hooks/use-inline-editing'
import type { TableRecord } from '../../shared/types'
import type {
  DataTableColumn,
  DataTableSelection,
} from '@/domain/models/app/pages/components/component-types/data/data-table/schema'

function buildSelectionColumn(mode?: string): ColumnDef<TableRecord> {
  return {
    id: 'select',
    header:
      mode === 'multiple'
        ? ({ table: t }) => (
            <input
              type="checkbox"
              checked={t.getIsAllRowsSelected()}
              onChange={t.getToggleAllRowsSelectedHandler()}
              aria-label="Select all rows"
            />
          )
        : '',
    cell: ({ row }) => (
      <input
        type="checkbox"
        checked={row.getIsSelected()}
        disabled={!row.getCanSelect()}
        onChange={row.getToggleSelectedHandler()}
        // The checkbox owns its own click, on the same terms an editable cell
        // does. Without this the click ALSO reaches the row, so on a grid whose
        // rows carry an action — a row-click navigation, or a `rowExpand` — the
        // reader ticking three rows to act on them would open (and re-open) a
        // record panel per tick. Selecting is a gesture about the row, not a
        // gesture on it.
        onClick={stopClickPropagation}
        aria-label={`Select row ${row.index + 1}`}
      />
    ),
    enableSorting: false,
    enableColumnFilter: false,
  }
}

/**
 * Build the leading row-number column a grid declaring `showRowNumbers` draws.
 *
 * The ordinal counts through the VIEW, not the page: `row.index` is the index
 * within the current page's data (the grid pages server-side), so it is offset
 * by the rows that came before. A per-page 1..N would make two different rows
 * both "row 1", which is the one thing a row number exists to prevent.
 */
function buildRowNumberColumn(offset: number): ColumnDef<TableRecord> {
  return {
    id: '__row_number',
    header: '#',
    enableSorting: false,
    enableColumnFilter: false,
    size: 48,
    cell: ({ row }) => (
      <span
        data-row-number=""
        className="text-[var(--sv-fg-muted,oklch(0.445_0_0))] tabular-nums"
      >
        {offset + row.index + 1}
      </span>
    ),
  }
}

/**
 * Options for {@link buildColumns}
 */
export interface BuildColumnsOptions {
  readonly columnConfig: readonly DataTableColumn[] | undefined
  readonly records: readonly TableRecord[]
  readonly selectionConfig: DataTableSelection | undefined
  readonly tableFields?: readonly string[]
  readonly onActionClick?: RowActionHandler
  /**
   * Field-type metadata keyed by field name. When provided, columns without an
   * explicit `format` literal opt into the field-type-driven read-only cell
   * renderer (user pill, status pill, JSON preview, …). Threaded down from
   * `use-island-setup`'s `params.fieldMeta`.
   */
  readonly fieldMeta?: FieldMetaMap
  /**
   * When true, auto-generated columns (no explicit `columns` config) opt into
   * inline double-click editing. Used by `refreshMode: 'realtime'` tables,
   * which are inline-editable by default so optimistic updates can fire.
   */
  readonly autoColumnsEditable?: boolean
  /** Draw the leading row-number column (schema `showRowNumbers`). */
  readonly showRowNumbers?: boolean
  /** Rows that precede the current page — `pageIndex * pageSize`. */
  readonly rowNumberOffset?: number
  /**
   * The bound table's name. Lets a `type: 'button'` cell address its own
   * invoke endpoint (`…/records/:id/buttons/:field`).
   */
  readonly tableName?: string
  /**
   * Re-reads the rows after a button run that may have written to one. A
   * button's automation commonly updates the very record it was pressed on,
   * which would otherwise leave the grid showing pre-run values until the
   * reader reloaded the page by hand.
   */
  readonly onButtonInvoked?: () => void
  /**
   * Interpreter-provided commit / dismiss labels for the action column's inline
   * select-editor and confirm gate, resolved server-side against the app
   * language. Absent for the callers that draw no action column.
   */
  readonly saveLabel?: string
  readonly cancelLabel?: string
}

export function buildColumns(options: BuildColumnsOptions): ColumnDef<TableRecord>[] {
  const {
    columnConfig,
    records,
    selectionConfig,
    tableFields,
    onActionClick,
    fieldMeta,
    autoColumnsEditable,
    showRowNumbers,
    rowNumberOffset,
    tableName,
    onButtonInvoked,
    saveLabel,
    cancelLabel,
  } = options

  // The active page locale (`<html lang>` ← `meta.lang`) drives locale-aware
  // column formats (`relative-time` → "dans N j" / "il y a N j" in fr).
  const locale = resolvePageLocale()

  // When no explicit columns: prefer tableFields (user-defined fields) over record keys
  // (which may include system fields like id, created_at)
  const autoOptions = {
    editable: autoColumnsEditable,
    fieldMeta,
    tableName,
    onButtonInvoked,
  }

  const baseColumns: ColumnDef<TableRecord>[] =
    columnConfig && columnConfig.length > 0
      ? [
          ...mapColumnsToColumnDefs(columnConfig, {
            locale,
            onActionClick,
            fieldMeta,
            tableName,
            onButtonInvoked,
            ...(saveLabel === undefined ? {} : { saveLabel }),
            ...(cancelLabel === undefined ? {} : { cancelLabel }),
          }),
        ]
      : tableFields && tableFields.length > 0
        ? [...autoGenerateColumnsFromFields(tableFields, autoOptions)]
        : [...autoGenerateColumns(records, autoOptions)]

  return [...buildLeadingColumns(selectionConfig, showRowNumbers, rowNumberOffset), ...baseColumns]
}

/**
 * The generated columns that precede the author's own, outermost first: the
 * selection checkbox owns the far left (it is the control the reader acts
 * through), the row number sits inside it.
 */
function buildLeadingColumns(
  selectionConfig: DataTableSelection | undefined,
  showRowNumbers: boolean | undefined,
  rowNumberOffset: number | undefined
): ColumnDef<TableRecord>[] {
  const selectionEnabled =
    selectionConfig?.mode === 'single' || selectionConfig?.mode === 'multiple'
  return [
    ...(selectionEnabled ? [buildSelectionColumn(selectionConfig?.mode)] : []),
    ...(showRowNumbers === true ? [buildRowNumberColumn(rowNumberOffset ?? 0)] : []),
  ]
}
