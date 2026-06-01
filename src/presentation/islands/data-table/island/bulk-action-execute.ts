/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { TableRecord } from '../../shared/types'
import type { DataTableBulkAction } from '@/domain/models/app/pages/components/data-table'
import type { useReactTable } from '@tanstack/react-table'

function buildBulkFormAction(
  tableName: string,
  operation: 'delete' | 'update' | string
): string | undefined {
  if (operation === 'delete') return `/api/tables/${tableName}/records/bulk-delete`
  if (operation === 'update') return `/api/tables/${tableName}/records/bulk-update`
  return undefined
}

function appendHiddenInput(form: HTMLFormElement, name: string, value: string): void {
  const input = document.createElement('input')
  input.type = 'hidden'
  input.name = name
  input.value = value
  form.appendChild(input)
}

export function executeBulkAction(
  table: ReturnType<typeof useReactTable<TableRecord>>,
  action: DataTableBulkAction
): void {
  if (!('type' in action.action) || action.action.type !== 'crud') return

  const crudAction = action.action
  const formAction = buildBulkFormAction(crudAction.table, crudAction.operation)
  if (!formAction) return

  const selectedIds = table
    .getFilteredSelectedRowModel()
    .rows.map((row) => String(row.original['id'] ?? ''))

  const form = document.createElement('form')
  form.method = 'POST'
  form.style.display = 'none'
  form.action = formAction

  appendHiddenInput(form, '_ids', JSON.stringify(selectedIds))
  appendHiddenInput(form, '_redirect', window.location.pathname)

  if (crudAction.operation === 'update' && crudAction.data) {
    appendHiddenInput(form, '_data', JSON.stringify(crudAction.data))
  }

  document.body.appendChild(form)
  form.submit()
}
