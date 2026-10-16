/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A record sheet footer's `crud` action, run against the record the sheet
 * shows once its question is answered.
 *
 * `delete` removes that record and `update` writes the action's `data` onto it,
 * through the same records endpoint a grid's row action calls. An accepted
 * write is announced as `sovrium:crud-success`, which the grid behind the sheet
 * hears: a delete takes the row out at once and re-reads once, an update
 * re-reads (`data-table/island/use-refresh-channels.ts`). A delete then closes
 * the sheet, since the record it showed is gone; an update closes it only when
 * the action asks with `onSuccess.close`. A refused write closes nothing: a 429
 * says how long to wait and any other refusal says it failed, both through the
 * shared write toasts, unless the action declares its own `onError` toast.
 *
 * `create` never reaches here: a footer acts on a record that already exists,
 * so the page decode rules refuse it when the config is read.
 */

import { dispatch } from '../runtime/event-bus'
import { renderToast } from '../runtime/toast'
import { toastWriteFailure, toastWriteRefusal } from '../runtime/write-refusal'
import type { CrudAction } from '@/domain/models/app/pages/components/action-operations'

/** The page-language words of a refused write, keyed by catalogue key. */
export type WriteRefusalStrings = Readonly<Record<string, string>>

/** The request the operation sends for record `recordId`, or `undefined` for one a footer cannot run. */
function crudRequest(action: CrudAction, recordId: string): Promise<Response> | undefined {
  const url = `/api/tables/${encodeURIComponent(action.table)}/records/${encodeURIComponent(recordId)}`
  if (action.operation === 'delete') return fetch(url, { method: 'DELETE' })
  if (action.operation !== 'update') return undefined
  return fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(action.data ?? {}),
  })
}

/** Say a write failed: the action's own `onError` toast, else the shared words. */
function reportFailure(
  action: CrudAction,
  response: Response | undefined,
  strings: WriteRefusalStrings | undefined
): void {
  if (response !== undefined && toastWriteRefusal(response, strings)) return
  const own = action.onError?.toast
  if (own?.message) {
    renderToast(own.message, own.variant)
    return
  }
  toastWriteFailure(strings)
}

/** What the sheet does after the write: close, or read its record again. */
export interface CrudSettle {
  readonly onLeave: () => void
  readonly onWritten: () => void
}

/**
 * An accepted write: its toast, the grid told, and the sheet closed after a
 * delete — or, kept open after an update, reading its record again.
 */
function settleWritten(action: CrudAction, recordId: string, settle: CrudSettle): void {
  const toast = action.onSuccess?.toast
  if (toast?.message) renderToast(toast.message, toast.variant)
  const operation = action.operation === 'delete' ? 'delete' : 'update'
  dispatch('sovrium:crud-success', { table: action.table, operation, recordId })
  if (operation === 'delete' || action.onSuccess?.close === true) settle.onLeave()
  else settle.onWritten()
}

/**
 * Run the footer's `crud` action against `record`. `settle` closes the sheet
 * the footer belongs to, or has it read the record again.
 */
export async function runDrawerCrud(
  action: CrudAction,
  record: Readonly<Record<string, unknown>>,
  settle: CrudSettle,
  strings: WriteRefusalStrings | undefined
): Promise<void> {
  const recordId = String(record['id'] ?? '')
  const sent = recordId === '' ? undefined : crudRequest(action, recordId)
  if (sent === undefined) return
  const response = await sent.catch(() => undefined)
  if (response?.ok === true) settleWritten(action, recordId, settle)
  else reportFailure(action, response, strings)
}
