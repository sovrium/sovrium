/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ColumnDef } from '@tanstack/react-table'
import {
  autoGenerateColumns,
  autoGenerateColumnsFromFields,
  mapColumnsToColumnDefs,
  type RowActionHandler,
} from '../formatting'
import type { TableRecord } from '../../shared/types'
import type {
  DataTableColumn,
  DataTableSelection,
} from '@/domain/models/app/pages/components/data-table'

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
        aria-label={`Select row ${row.index + 1}`}
      />
    ),
    enableSorting: false,
    enableColumnFilter: false,
  }
}

export interface BuildColumnsOptions {
  readonly columnConfig: readonly DataTableColumn[] | undefined
  readonly records: readonly TableRecord[]
  readonly selectionConfig: DataTableSelection | undefined
  readonly tableFields?: readonly string[]
  readonly groupByField?: string
  readonly onActionClick?: RowActionHandler
}

export function buildColumns(options: BuildColumnsOptions): ColumnDef<TableRecord>[] {
  const { columnConfig, records, selectionConfig, tableFields, groupByField, onActionClick } =
    options

  const baseColumns: ColumnDef<TableRecord>[] =
    columnConfig && columnConfig.length > 0
      ? [...mapColumnsToColumnDefs(columnConfig, groupByField, onActionClick)]
      : tableFields && tableFields.length > 0
        ? [...autoGenerateColumnsFromFields(tableFields, groupByField)]
        : [...autoGenerateColumns(records, groupByField)]

  const selectionEnabled =
    selectionConfig?.mode === 'single' || selectionConfig?.mode === 'multiple'

  return selectionEnabled
    ? [buildSelectionColumn(selectionConfig?.mode), ...baseColumns]
    : baseColumns
}
