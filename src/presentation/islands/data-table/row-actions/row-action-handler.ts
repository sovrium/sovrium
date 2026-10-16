/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { executeFetchAction } from '../../runtime/action-executor'
import { runSuccessOutcome } from '../../runtime/action-outcome'
import { dispatch as dispatchIslandEvent } from '../../runtime/event-bus'
import { substituteRecord } from '../../runtime/fetch-action-substitution'
import { renderToast } from '../../runtime/toast'
import { toastWriteRefusal } from '../../runtime/write-refusal'
import { runAccountRowAction, type AccountRowAction } from './account-row-actions'
import { runAutomationRowAction, type AutomationRowAction } from './automation-row-action'
import { removeRowThenRefreshOnce } from './deleted-row-refresh'
import type { RowActionHandler } from './row-action-types'
import type { FetchAction } from '@/domain/models/app/pages/components/action'
import type { QueryClient } from '@tanstack/react-query'

interface CreateRowActionHandlerParams {
  readonly queryClient: QueryClient
  readonly queryKey: readonly unknown[]
  /**
   * The grid's table, `''` for a system-backed source. An `openSheet` action
   * names it so the drawer binds the row only to that table's update forms.
   */
  readonly tableName?: string
  /** The page-language strings, for a refusal's toast. */
  readonly strings?: Readonly<Record<string, string>> | undefined
}

type CrudAction = {
  readonly type: 'crud'
  readonly table: string
  readonly operation: 'delete' | 'update' | string
  readonly data?: unknown
  readonly onSuccess?: {
    readonly toast?: { readonly message?: string; readonly variant?: string }
    readonly close?: boolean
    readonly navigate?: string
  }
  readonly onError?: { readonly toast?: { readonly message?: string; readonly variant?: string } }
}

/**
 * What one press re-reads and where it came from: the grid's query, and the
 * pressed button — the overlay holding the table is the one `close` closes,
 * asked BEFORE the re-read replaces the button.
 */
interface RowPress {
  readonly queryClient: QueryClient
  readonly queryKey: readonly unknown[]
  readonly origin: Element | undefined
  readonly strings?: Readonly<Record<string, string>> | undefined
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
  press: RowPress
): Promise<void> {
  const { origin } = press
  const result = await executeFetchAction(fetchAction, {
    renderToast,
    record,
    ...(origin === undefined ? {} : { origin }),
  })
  if (result?.ok) await press.queryClient.invalidateQueries({ queryKey: press.queryKey })
}

/** A refused write: rate limit says how long to wait; anything else shows `onError`. */
const reportCrudFailure = (
  crudAction: CrudAction,
  response: Response | undefined,
  press: RowPress
): void => {
  if (response !== undefined && toastWriteRefusal(response, press.strings)) return
  renderCrudToast(crudAction, 'error')
}

/**
 * What the grid re-reads after an accepted write: a delete takes the row out at
 * once and re-reads once the deletes pause (`deleted-row-refresh.ts`), so a
 * reader clearing rows one by one does not re-read the page per delete; an
 * update re-reads now.
 */
const refreshAfter = (crudAction: CrudAction, recordId: string, press: RowPress) => {
  if (crudAction.operation !== 'delete') {
    return press.queryClient.invalidateQueries({ queryKey: press.queryKey })
  }
  removeRowThenRefreshOnce(press.queryClient, press.queryKey, recordId)
  return Promise.resolve()
}

/**
 * Issue the configured CRUD operation against the records API, render the
 * success/error toast, and invalidate the table query on success. An accepted
 * write then follows `onSuccess.navigate`, its `$record.<field>` filled from the
 * row pressed — as an automation or `fetch` row action does.
 */
async function runCrudRowAction(
  crudAction: CrudAction,
  record: Record<string, unknown>,
  press: RowPress
): Promise<void> {
  const recordId = String(record['id'] ?? '')
  if (!recordId) return
  try {
    const response = await performCrudRequest(crudAction, recordId)
    if (response && response.ok) {
      const navigate = crudAction.onSuccess?.navigate
      runSuccessOutcome(press.origin, {
        toast: () => renderCrudToast(crudAction, 'success'),
        close: crudAction.onSuccess?.close,
        navigate: navigate === undefined ? undefined : substituteRecord(navigate, record),
      })
      await refreshAfter(crudAction, recordId, press)
    } else {
      reportCrudFailure(crudAction, response, press)
    }
  } catch {
    renderCrudToast(crudAction, 'error')
  }
}

/**
 * The row actions that issue their own request and report whether it was
 * accepted: an item-level account method (`auth` with a `target`) and an
 * automation press, whose `inputData` is filled from the clicked row.
 * `undefined` for any other action.
 */
function runSelfReportingRowAction(
  action: { readonly type: string },
  record: Record<string, unknown>,
  origin: Element | undefined
): Promise<boolean> | undefined {
  if (action.type === 'auth') {
    return runAccountRowAction(action as AccountRowAction, record, renderToast)
  }
  if (action.type === 'automation') {
    return runAutomationRowAction(action as AutomationRowAction, record, renderToast, origin)
  }
  return undefined
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
  tableName,
  strings,
}: CreateRowActionHandlerParams): RowActionHandler {
  return async (action, record, origin) => {
    const press: RowPress = { queryClient, queryKey, origin, strings }
    // OpenDrawer action (discriminated by `action: 'openSheet'`, not `type`):
    // fire the shared `sovrium:open-drawer` event so a sibling drawer / detail
    // island opens populated by the clicked row. Used by the automation-runs
    // directory's action column to open the run-detail pane over `…/runs/:runId`.
    const rawAction = action.action as { readonly action?: string; readonly component?: string }
    if (rawAction.action === 'openSheet' && typeof rawAction.component === 'string') {
      dispatchIslandEvent('sovrium:open-drawer', {
        id: rawAction.component,
        record: record as Record<string, unknown>,
        ...(tableName ? { table: tableName } : {}),
      })
      return
    }
    // Narrow off variants without a `type` discriminator (e.g. OpenDrawerAction
    // uses `action: openSheet` instead).
    if (!('type' in action.action)) return

    // Config `type: 'fetch'` operate action (Consoles-as-Config CAP-3).
    if (action.action.type === 'fetch') {
      await runFetchRowAction(
        action.action as FetchAction,
        record as Record<string, unknown>,
        press
      )
      return
    }

    // An item-level account method or an automation press: one request, then
    // the grid re-reads what the server now holds.
    const reported = runSelfReportingRowAction(
      action.action,
      record as Record<string, unknown>,
      origin
    )
    if (reported) {
      if (await reported) await queryClient.invalidateQueries({ queryKey })
      return
    }

    // Only the `crud` variant is otherwise honored by row-actions.
    if (action.action.type !== 'crud') return
    await runCrudRowAction(action.action as CrudAction, record as Record<string, unknown>, press)
  }
}
