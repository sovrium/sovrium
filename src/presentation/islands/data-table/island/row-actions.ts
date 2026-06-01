/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { renderToast } from './toast'
import type { RowActionHandler } from '../formatting'
import type { QueryClient } from '@tanstack/react-query'

interface CreateRowActionHandlerParams {
  readonly queryClient: QueryClient
  readonly queryKey: readonly unknown[]
}

type CrudAction = {
  readonly type: 'crud'
  readonly table: string
  readonly operation: 'delete' | 'update' | string
  readonly data?: unknown
  readonly onSuccess?: { readonly toast?: { readonly message?: string; readonly variant?: string } }
  readonly onError?: { readonly toast?: { readonly message?: string; readonly variant?: string } }
}

async function performCrudRequest(
  crudAction: CrudAction,
  recordId: string
): Promise<Response | undefined> {
  const url = `/api/tables/${crudAction.table}/records/${recordId}`
  if (crudAction.operation === 'delete') {
    return fetch(url, { method: 'DELETE' })
  }
  if (crudAction.operation === 'update') {
    return fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(crudAction.data ?? {}),
    })
  }
  return undefined
}

function renderCrudToast(crudAction: CrudAction, outcome: 'success' | 'error'): void {
  const slot = outcome === 'success' ? crudAction.onSuccess : crudAction.onError
  const message = slot?.toast?.message
  if (message) {
    renderToast(message, slot?.toast?.variant)
  }
}

export function createRowActionHandler({
  queryClient,
  queryKey,
}: CreateRowActionHandlerParams): RowActionHandler {
  return async (action, record) => {
    if (!('type' in action.action) || action.action.type !== 'crud') return
    const crudAction = action.action as unknown as CrudAction
    const recordId = String(record['id'] ?? '')
    if (!recordId) return

    try {
      const response = await performCrudRequest(crudAction, recordId)
      if (response && response.ok) {
        renderCrudToast(crudAction, 'success')
        await queryClient.invalidateQueries({ queryKey })
      } else {
        renderCrudToast(crudAction, 'error')
      }
    } catch {
      renderCrudToast(crudAction, 'error')
    }
  }
}
