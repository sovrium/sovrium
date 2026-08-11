/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { renderToast } from './toast'
import type { TableRecord } from '../../shared/types'
import type { DataTableBulkAction } from '@/domain/models/app/pages/components/component-types/data/data-table/schema'
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

/**
 * Build the endpoint URL for the given bulk-CRUD operation, or `undefined` if
 * the operation is not supported by the bulk endpoints.
 */
function buildBulkEndpoint(
  tableName: string,
  operation: 'delete' | 'update' | string
): string | undefined {
  if (operation === 'delete') return `/api/tables/${tableName}/records/bulk-delete`
  if (operation === 'update') return `/api/tables/${tableName}/records/bulk-update`
  return undefined
}

/**
 * Encode the request body the bulk endpoints expect.
 *
 * The endpoints read their inputs through Hono's `c.req.parseBody()`, so the
 * body stays form-encoded (`_ids`, `_data`) even though it now travels over
 * `fetch` rather than a submitted `<form>` — the wire contract is unchanged,
 * only the transport.
 *
 * `_redirect` is deliberately NOT sent. It existed solely to give the native
 * form submission somewhere to land, and the endpoints answer a 302 whenever it
 * is present; `fetch` follows redirects transparently, so including it would
 * resolve to the redirected page's HTML with `ok: true` and report success
 * without ever reading the operation's own result. The endpoints already treat
 * an absent `_redirect` as "reply with JSON", which is the branch this takes.
 */
function encodeBulkBody(crudAction: BulkCrudAction, ids: readonly string[]): URLSearchParams {
  const carriesData = crudAction.operation === 'update' && Boolean(crudAction.data)
  return new URLSearchParams({
    _ids: JSON.stringify(ids),
    ...(carriesData ? { _data: JSON.stringify(crudAction.data) } : {}),
  })
}

/**
 * Render the toast configured under the matching `onSuccess`/`onError` slot.
 */
function renderBulkToast(crudAction: BulkCrudAction, outcome: 'success' | 'error'): void {
  const slot = outcome === 'success' ? crudAction.onSuccess : crudAction.onError
  const message = slot?.toast?.message
  if (message) {
    renderToast(message, slot?.toast?.variant)
  }
}

/**
 * Execute a bulk action against the records API and report its outcome in
 * place: the configured success/error toast is rendered, and the table query is
 * invalidated on success so the rows refresh without a page reload.
 *
 * The endpoints are authorized per field and per value, so a bulk update can
 * legitimately be refused (a field the caller may not write, an engine-managed
 * readonly column, a value its column rejects). Every such refusal arrives as a
 * normal response with `ok: false`, which is why the outcome is decided from the
 * response rather than from whether the request threw.
 */
export async function executeBulkAction(
  table: ReturnType<typeof useReactTable<TableRecord>>,
  action: DataTableBulkAction,
  { queryClient, queryKey }: BulkActionContext
): Promise<void> {
  // OpenDrawerAction uses `action: openDrawer` instead of `type`; only the
  // `crud` variant supports the bulk-records workflow, so any non-typed or
  // non-crud action is a no-op.
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
