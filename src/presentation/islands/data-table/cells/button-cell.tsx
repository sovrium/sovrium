/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { GridRecordButton } from '../grid-record-button'
import type { FieldMetaMap } from '../../hooks/use-inline-editing'
import type { DataTableCellContext } from '../island/table-features'

/**
 * The slice of the column options a button cell reads. Shared by the explicit
 * and auto-generated column paths, whose own option bags both satisfy it.
 */
export interface ButtonCellOptions {
  readonly tableName?: string
  readonly fieldMeta?: FieldMetaMap
  /**
   * Refresh the grid after a run that may have written to the record. The grid
   * is the only surface a button field appears on that has a query cache, so
   * it is the only one that supplies this.
   */
  readonly onButtonInvoked?: () => void
}

/**
 * Build the cell renderer for a `type: 'button'` field, or `undefined` when
 * the field is not one.
 *
 * A button cell is an ACTION, not a readout, so it takes the whole row: its
 * `visibleWhen` reads the record, and an automation button needs the record id.
 */
export function buildButtonCellRenderer(
  field: string,
  options: ButtonCellOptions
): ((ctx: DataTableCellContext) => React.ReactNode) | undefined {
  const { tableName, fieldMeta, onButtonInvoked } = options
  const config = fieldMeta?.[field]?.button
  if (!config) return undefined
  return ({ row }: DataTableCellContext) => (
    <GridRecordButton
      config={config}
      fieldName={field}
      record={row.original}
      {...(tableName === undefined ? {} : { table: tableName })}
      {...(row.original['id'] === undefined ? {} : { recordId: String(row.original['id']) })}
      {...(onButtonInvoked === undefined ? {} : { onInvoked: onButtonInvoked })}
    />
  )
}
