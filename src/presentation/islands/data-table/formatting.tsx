/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveColumnLabel } from '@/presentation/design/field-display'
import { listEditedFields } from './cell-plain'
import { typePlacementOf } from './cells/type-placement'
import { buildFieldCellRenderer } from './cells/value-cell'
import { columnPresentationMeta, columnSortable } from './column-presentation'
import {
  DEFAULT_SAVE_LABEL,
  DEFAULT_CANCEL_LABEL,
  RowActionCell,
} from './row-actions/action-cell-renderer'
import { mergeActionColumns } from './row-actions/merge-action-columns'
import type { FieldMetaMap } from '../hooks/use-inline-editing'
import type { DataTableColumnDef, DataTableColumnMeta } from './island/table-features'
import type {
  ActionControlLabels,
  RowActionHandler,
  RowActionsDisplay,
} from './row-actions/row-action-types'
import type { DataTableColumn } from '@/domain/models/app/pages/components/component-types/data/table/schema'

/**
 * Options for {@link mapColumnsToColumnDefs}. `locale` (the active page locale,
 * `<html lang>` ← `meta.lang`) drives locale-aware column formats (`relative-time`);
 * the rest mirror the prior positional parameters.
 */
/**
 * The action cluster's meta: its cells are buttons, and the LAST column — the
 * usual place for it — is pinned to the grid's right edge.
 */
const actionColumnMeta = (last: boolean): DataTableColumnMeta =>
  last ? { actions: true, trailing: true } : { actions: true }

export interface MapColumnsOptions {
  readonly locale: string
  readonly onActionClick?: RowActionHandler
  readonly fieldMeta?: FieldMetaMap
  /** Lets an automation button in a field column address its invoke endpoint. */
  readonly tableName?: string
  /** Re-reads the rows after a button run that may have written to one. */
  readonly onButtonInvoked?: () => void
  /**
   * Interpreter-provided commit / dismiss labels for the action column's inline
   * select-editor and confirm gate, resolved server-side against the app
   * language. Default to the English platform strings.
   */
  readonly saveLabel?: string
  readonly cancelLabel?: string
  /** How the action column draws its actions (`rowActions.display`). */
  readonly rowActionsDisplay?: RowActionsDisplay
}

/**
 * Converts domain DataTableColumn configs into TanStack Table ColumnDef objects.
 *
 * Field columns: accessorKey, header, cell renderer with format/cellStyle, sort/filter flags.
 * Action columns: id, action button cell renderer.
 */
export function mapColumnsToColumnDefs(
  columns: readonly DataTableColumn[],
  options: MapColumnsOptions
): readonly DataTableColumnDef[] {
  const { locale, onActionClick } = options
  const actionLabels: ActionControlLabels = {
    save: options.saveLabel ?? DEFAULT_SAVE_LABEL,
    cancel: options.cancelLabel ?? DEFAULT_CANCEL_LABEL,
  }
  // Filter out columns with visible: false
  // In menu display a row has one menu, however many action columns feed it.
  const shown = options.rowActionsDisplay === 'menu' ? mergeActionColumns(columns) : columns
  const visibleColumns = shown.filter((col) => !('field' in col && col.visible === false))
  const listFields = listEditedFields(columns)

  return visibleColumns.map((col, index) => {
    if ('field' in col) {
      const cellRenderer = buildFieldCellRenderer(col, locale, options, listFields)
      return {
        accessorKey: col.field,
        // The column's own `label` override, then the bound field's declared
        // `label`, then the field name made readable.
        header: resolveColumnLabel(col.label, options.fieldMeta?.[col.field]?.label, col.field),
        enableSorting: columnSortable(col, options.fieldMeta),
        enableColumnFilter: col.filterable !== false,
        ...(col.width && { size: col.width }),
        ...(col.minWidth && { minSize: col.minWidth }),
        ...(cellRenderer && { cell: cellRenderer }),
        meta: {
          frozen: col.frozen,
          ...columnPresentationMeta(col),
          field: col.field,
          editable: col.editable,
          // Carried beside `size` above so the header cell can tell an authored
          // width from TanStack's merged-in default, which `getSize()` cannot.
          authoredWidth: col.width,
          ...typePlacementOf(col.align, options.fieldMeta?.[col.field]?.type),
        },
      } satisfies DataTableColumnDef
    }
    return {
      id: `actions-${String(index)}`,
      header: col.label ?? '',
      enableSorting: false,
      enableColumnFilter: false,
      cell: RowActionCell,
      // The cluster is a set of buttons, and the row renderer has to know that
      // before it decides whose click a press is.
      meta: {
        ...actionColumnMeta(index === visibleColumns.length - 1),
        rowActions: {
          col,
          onActionClick,
          labels: actionLabels,
          display: options.rowActionsDisplay,
        },
      },
    } satisfies DataTableColumnDef
  })
}
