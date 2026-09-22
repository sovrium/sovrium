/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { executeFetchAction } from '../../runtime/action-executor'
import { dispatch as dispatchIslandEvent } from '../../runtime/event-bus'
import { renderToast } from './toast'
import type { RowActionHandler } from '../formatting'
import type { FetchAction } from '@/domain/models/app/pages/components/action'
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

/**
 * Issue the HTTP request for the configured CRUD operation.
 *
 * Returns `undefined` when the operation is not one of the supported verbs
 * (the calling code treats that as an error/no-toast scenario).
 */
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

/**
 * Render the toast configured under the matching `onSuccess`/`onError` slot.
 */
function renderCrudToast(crudAction: CrudAction, outcome: 'success' | 'error'): void {
  const slot = outcome === 'success' ? crudAction.onSuccess : crudAction.onError
  const message = slot?.toast?.message
  if (message) {
    renderToast(message, slot?.toast?.variant)
  }
}

/**
 * Dispatch a config `type: 'fetch'` operate action (Consoles-as-Config CAP-3)
 * through the shared action-executor, then refresh the table when the response
 * is a success under the action's `responseEnvelope`.
 *
 * The clicked `record` is threaded through so a `navigate` / `download` action
 * target resolves its `$record.<field>` references against the row (e.g. a
 * per-file download over `…/files/$record.key`).
 */
async function runFetchRowAction(
  fetchAction: FetchAction,
  record: Record<string, unknown>,
  queryClient: QueryClient,
  queryKey: readonly unknown[]
): Promise<void> {
  const result = await executeFetchAction(fetchAction, { renderToast, record })
  if (result?.ok) await queryClient.invalidateQueries({ queryKey })
}

/**
 * Issue the configured CRUD operation against the records API, render the
 * success/error toast, and invalidate the table query on success.
 */
async function runCrudRowAction(
  crudAction: CrudAction,
  record: Record<string, unknown>,
  queryClient: QueryClient,
  queryKey: readonly unknown[]
): Promise<void> {
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

/**
 * Create a row-action handler closed over the current query client and
 * query key.
 *
 * Performs the CRUD operation against the records API, then renders the
 * configured success/error toast. The query cache is invalidated on success
 * so the table reflects the updated row without a full page navigation.
 */
export function createRowActionHandler({
  queryClient,
  queryKey,
}: CreateRowActionHandlerParams): RowActionHandler {
  return async (action, record) => {
    // OpenDrawer action (discriminated by `action: 'openDrawer'`, not `type`):
    // fire the shared `sovrium:open-drawer` event so a sibling drawer / detail
    // island opens populated by the clicked row. Used by the automation-runs
    // directory's action column to open the run-detail pane over `…/runs/:runId`.
    const rawAction = action.action as { readonly action?: string; readonly component?: string }
    if (rawAction.action === 'openDrawer' && typeof rawAction.component === 'string') {
      dispatchIslandEvent('sovrium:open-drawer', {
        id: rawAction.component,
        record: record as Record<string, unknown>,
      })
      return
    }
    // Narrow off variants without a `type` discriminator (e.g. OpenDrawerAction
    // uses `action: openDrawer` instead).
    if (!('type' in action.action)) return

    // Config `type: 'fetch'` operate action (Consoles-as-Config CAP-3).
    if (action.action.type === 'fetch') {
      await runFetchRowAction(
        action.action as unknown as FetchAction,
        record as Record<string, unknown>,
        queryClient,
        queryKey
      )
      return
    }

    // Only the `crud` variant is otherwise honored by row-actions.
    if (action.action.type !== 'crud') return
    await runCrudRowAction(
      action.action as unknown as CrudAction,
      record as Record<string, unknown>,
      queryClient,
      queryKey
    )
  }
}
