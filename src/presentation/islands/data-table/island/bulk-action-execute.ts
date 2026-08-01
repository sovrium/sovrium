/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { renderToast } from './toast'
import type { TableRecord } from '../../shared/types'
import type { DataTableBulkAction } from '@/domain/models/app/pages/components/data-table'
import type { QueryClient } from '@tanstack/react-query'
import type { useReactTable } from '@tanstack/react-table'

interface BulkActionContext {
  readonly queryClient: QueryClient
  readonly queryKey: readonly unknown[]
}

type BulkCrudAction = {
  readonly type: 'crud'
  readonly table: string
  readonly operation: 'delete' | 'update' | string
  readonly data?: unknown
  readonly onSuccess?: { readonly toast?: { readonly message?: string; readonly variant?: string } }
  readonly onError?: { readonly toast?: { readonly message?: string; readonly variant?: string } }
}

function buildBulkEndpoint(
  tableName: string,
  operation: 'delete' | 'update' | string
): string | undefined {
  if (operation === 'delete') return `/api/tables/${tableName}/records/bulk-delete`
  if (operation === 'update') return `/api/tables/${tableName}/records/bulk-update`
  return undefined
}

function encodeBulkBody(crudAction: BulkCrudAction, ids: readonly string[]): URLSearchParams {
  const carriesData = crudAction.operation === 'update' && Boolean(crudAction.data)
  return new URLSearchParams({
    _ids: JSON.stringify(ids),
    ...(carriesData ? { _data: JSON.stringify(crudAction.data) } : {}),
  })
}

function renderBulkToast(crudAction: BulkCrudAction, outcome: 'success' | 'error'): void {
  const slot = outcome === 'success' ? crudAction.onSuccess : crudAction.onError
  const message = slot?.toast?.message
  if (message) {
    renderToast(message, slot?.toast?.variant)
  }
}

export async function executeBulkAction(
  table: ReturnType<typeof useReactTable<TableRecord>>,
  action: DataTableBulkAction,
  { queryClient, queryKey }: BulkActionContext
): Promise<void> {
  if (!('type' in action.action) || action.action.type !== 'crud') return

  const crudAction = action.action as unknown as BulkCrudAction
  const endpoint = buildBulkEndpoint(crudAction.table, crudAction.operation)
  if (!endpoint) return

  const ids = table
    .getFilteredSelectedRowModel()
    .rows.map((row) => String(row.original['id'] ?? ''))

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      body: encodeBulkBody(crudAction, ids),
    })
    if (response.ok) {
      renderBulkToast(crudAction, 'success')
      await queryClient.invalidateQueries({ queryKey })
    } else {
      renderBulkToast(crudAction, 'error')
    }
  } catch {
    renderBulkToast(crudAction, 'error')
  }
}
