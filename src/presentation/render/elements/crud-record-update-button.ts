/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { substituteRecordVars } from '@/domain/models/app/pages/substitute-record-vars'
import { buildFetchDataAttributes } from './button-action-builders'
import type { CrudFormAction } from './crud-form/crud-form-types'
import type { FetchAction } from '@/domain/models/app/pages/components/action'

/**
 * A `crud` update a button sends for the record it is drawn for, writing the
 * action's fixed `data` — a moderator's Pin on a turn of a conversation. It
 * rides the fetch runtime as `PATCH /api/tables/<table>/records/<id>`, so the
 * records API's own permission gate answers it, a refusal is that route's 404,
 * and a table followed live redraws from the change it announces.
 *
 * Once the write succeeds, the action's `onSuccess.navigate` is followed, its
 * `$record.<field>` filled from the record the button is drawn for: to another
 * page, or to the same address, which loads the page again with its new value.
 */
export function buildCrudRecordUpdateAttributes(
  action: CrudFormAction & { readonly data: Readonly<Record<string, unknown>> },
  record: Readonly<Record<string, unknown>> | undefined
): Record<string, string> | undefined {
  const recordId = record?.['id']
  if (typeof recordId !== 'string' && typeof recordId !== 'number') return undefined
  const success = successOf(action, record ?? {})
  return buildFetchDataAttributes({
    type: 'fetch',
    url: `/api/tables/${encodeURIComponent(action.table)}/records/${encodeURIComponent(String(recordId))}`,
    method: 'PATCH',
    body: { fields: action.data },
    // The toasts the action declares, in the fetch action's shape.
    ...(success !== undefined ? { onSuccess: success } : {}),
    ...(action.onError?.toast !== undefined ? { onError: { ...action.onError.toast } } : {}),
    ...(action.confirm === true ? { confirm: true } : {}),
    ...(action.confirmMessage !== undefined ? { confirmMessage: action.confirmMessage } : {}),
  } as FetchAction)
}

/** The fetch action's `onSuccess`: the action's toast, then where it goes, record filled in. */
function successOf(
  action: CrudFormAction,
  record: Readonly<Record<string, unknown>>
): Record<string, unknown> | undefined {
  const toast = action.onSuccess?.toast
  const navigate = action.onSuccess?.navigate
  if (toast === undefined && navigate === undefined) return undefined
  return {
    ...toast,
    ...(navigate !== undefined && { navigate: substituteRecordVars(navigate, record) }),
  }
}

/** True for a `crud` update carrying fixed `data`: a one-press write to its record. */
export function isCrudRecordUpdate(
  action: unknown
): action is CrudFormAction & { readonly data: Readonly<Record<string, unknown>> } {
  const crud = action as (CrudFormAction & { readonly data?: unknown }) | undefined
  return (
    crud?.type === 'crud' &&
    crud.operation === 'update' &&
    crud.data !== null &&
    typeof crud.data === 'object'
  )
}
