/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Whether a control is disabled on its record, read the same way by every
 * surface that draws one: a `button` placed on a record (server-rendered), a
 * button field (the grid cell, the edit form, the drawer), and a row action
 * (its button and its menu item).
 *
 * The verdict is the server's: the record a page or the records API hands over
 * carries the ids of the controls disabled on it under `_disabled`, judged on
 * the whole row. The condition itself never reaches the client, so there is
 * nothing to evaluate here — only the id to look up, and the reason to fill
 * from the record (a field the reader may not read is not in the record, and
 * reads as empty).
 *
 * Kept apart from `disabled-reason.tsx`, which draws the verdict, so a lazy
 * surface that only draws a verdict decided elsewhere does not ship the record
 * substitution.
 */

import { substituteRecordVars } from '@/domain/models/app/pages/substitute-record-vars'

/** A control its record disables, with the reason it gives (absent when none). */
export interface DisabledVerdict {
  readonly reason: string | undefined
}

/**
 * The verdict on `controlId` read off `record`'s `_disabled`, with `reason`
 * filled from the record; `undefined` when the control is usable there, or
 * when there is no record or no id to read it for.
 */
export function disabledOnRecord(
  record: Readonly<Record<string, unknown>> | undefined,
  controlId: string | undefined,
  reason: string | undefined
): DisabledVerdict | undefined {
  if (record === undefined || controlId === undefined) return undefined
  const listed = record['_disabled']
  if (!Array.isArray(listed) || !listed.includes(controlId)) return undefined
  return { reason: reason === undefined ? undefined : substituteRecordVars(reason, record) }
}
