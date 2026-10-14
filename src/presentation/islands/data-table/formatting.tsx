/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveDisplayLabel } from '@/presentation/design/field-display'
import { listEditedFields } from './cell-plain'
import { typePlacementOf } from './cells/type-placement'
import { buildFieldCellRenderer } from './cells/value-cell'
import { columnPresentationMeta } from './column-presentation'
import {
  DEFAULT_SAVE_LABEL,
  DEFAULT_CANCEL_LABEL,
  buildActionCellRenderer,
} from './row-actions/action-cell-renderer'
import type { FieldMetaMap } from '../hooks/use-inline-editing'
import type { DataTableColumnDef } from './island/table-features'
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
  const visibleColumns = columns.filter((col) => !('field' in col && col.visible === false))
  const listFields = listEditedFields(columns)

  return visibleColumns.map((col, index) => {
    if ('field' in col) {
      const cellRenderer = buildFieldCellRenderer(col, locale, options, listFields)
      return {
        accessorKey: col.field,
        // The column's own `label` override, then the bound field's declared
        // `label`, then the RAW field name — the same order every surface uses.
        header: resolveDisplayLabel(col.label, options.fieldMeta?.[col.field]?.label, col.field),
        enableSorting: col.sortable !== false,
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
      cell: buildActionCellRenderer(col, onActionClick, actionLabels, options.rowActionsDisplay),
      // The cluster is a set of buttons, and the row renderer has to know that
      // before it decides whose click a press is.
      meta: { actions: true },
    } satisfies DataTableColumnDef
  })
}
