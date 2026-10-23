/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { buildFetchDataAttributes } from './button-action-builders'
import type { CrudFormAction } from './crud-form/crud-form-types'
import type { FetchAction } from '@/domain/models/app/pages/components/action'

/**
 * A `crud` update a button sends for the record it is drawn for, writing the
 * action's fixed `data` — a moderator's Pin on a turn of a conversation. It
 * rides the fetch runtime as `PATCH /api/tables/<table>/records/<id>`, so the
 * records API's own permission gate answers it, a refusal is that route's 404,
 * and a table followed live redraws from the change it announces.
 */
export function buildCrudRecordUpdateAttributes(
  action: CrudFormAction & { readonly data: Readonly<Record<string, unknown>> },
  recordId: unknown
): Record<string, string> | undefined {
  if (typeof recordId !== 'string' && typeof recordId !== 'number') return undefined
  return buildFetchDataAttributes({
    type: 'fetch',
    url: `/api/tables/${encodeURIComponent(action.table)}/records/${encodeURIComponent(String(recordId))}`,
    method: 'PATCH',
    body: { fields: action.data },
    ...(action.confirm === true ? { confirm: true } : {}),
    ...(action.confirmMessage !== undefined ? { confirmMessage: action.confirmMessage } : {}),
  } as FetchAction)
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
