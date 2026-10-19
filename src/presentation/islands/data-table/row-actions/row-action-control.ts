/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A row action as a control the server judges on its row (`disabledWhen`,
 * `visibleWhen` on an automation): the id the page stamped on it, whether the
 * row's record read lists it as disabled, and the record reference its press
 * sends. The condition itself never reaches the grid — only the verdict, in
 * the record's `_disabled`.
 */

import { substituteRecordVars } from '@/domain/models/app/pages/substitute-record-vars'
import type { TableRecord } from '../../runtime/types'
import type { ActionColumnItem } from '@/domain/models/app/pages/components/component-types/data/table/schema'

/** The id the page stamped on a conditioned row action, or `undefined`. */
export function controlIdOf(item: ActionColumnItem): string | undefined {
  const id = (item as { readonly _controlId?: unknown })._controlId
  return typeof id === 'string' ? id : undefined
}

/**
 * The action is disabled on this row — its id is in the row's `_disabled` —
 * with its reason filled from the row (a field the reader may not read is not
 * in the row, and reads as empty). `undefined` when it is usable.
 */
export function rowActionDisabledOn(
  item: ActionColumnItem,
  record: TableRecord
): { readonly reason: string | undefined } | undefined {
  const id = controlIdOf(item)
  const disabled = record['_disabled']
  if (id === undefined || !Array.isArray(disabled) || !disabled.includes(id)) return undefined
  const { disabledReason } = item
  return {
    reason: disabledReason === undefined ? undefined : substituteRecordVars(disabledReason, record),
  }
}

/** The record a row action's press names, for the server to judge it on; `undefined` when none. */
export function rowPressReference(
  item: ActionColumnItem,
  record: TableRecord,
  tableName: string | undefined
): { readonly table: string; readonly recordId: string; readonly control: string } | undefined {
  const control = controlIdOf(item)
  const { id } = record
  if (control === undefined || !tableName || (typeof id !== 'string' && typeof id !== 'number')) {
    return undefined
  }
  return { table: tableName, recordId: String(id), control }
}
