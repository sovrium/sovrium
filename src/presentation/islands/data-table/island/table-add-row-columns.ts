/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { TableContentProps } from './table-content-types'
import type { FieldMetaMap } from '../../hooks/use-inline-editing'
import type { AddRowConfig } from '../add-row'
import type { AddRowColumn } from '../use-add-row-draft'
import type { DataTableGridColumn } from './table-features'

/**
 * The trailing add-row's wiring, or nothing when the role cannot create — one
 * column entry per visible leaf column so the row's cells line up under the
 * grid's, each carrying what the row needs to know about its field.
 */
export function resolveAddRow(
  props: TableContentProps,
  leafColumns: readonly DataTableGridColumn[],
  labelOf: (field: string) => string
): AddRowConfig | undefined {
  const { canCreate, onRecordCreated, tableName, fieldMeta } = props
  if (canCreate !== true || onRecordCreated === undefined || tableName === '') return undefined
  return {
    tableName,
    fieldMeta,
    cellClass: props.cellClass,
    borderClass: props.borderClass,
    onCreated: onRecordCreated,
    columns: leafColumns.map((column) => toAddRowColumn(column, fieldMeta, labelOf)),
  }
}

/** One visible leaf column, as the add-row needs to know it. */
function toAddRowColumn(
  column: DataTableGridColumn,
  fieldMeta: FieldMetaMap | undefined,
  labelOf: (field: string) => string
): AddRowColumn {
  const field = column.columnDef.meta?.field
  if (field === undefined) return { label: column.id, required: false }
  const meta = fieldMeta?.[field]
  return {
    field,
    label: labelOf(field),
    ...(meta?.type !== undefined && { type: meta.type }),
    required: meta?.required === true,
    ...(meta?.options !== undefined && { options: meta.options }),
  }
}
