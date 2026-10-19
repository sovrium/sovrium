/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { RECORD_TEXT_KEY } from '@/domain/models/app/pages/substitute-record-vars'
import { storedValueText } from './record-value-format'

/**
 * A system record whose lists read as the page language joins a list.
 *
 * A system record has no table, so no field type says how a value reads; a
 * list is unambiguous anyway. Each one prints its items joined as `locale`
 * joins a list (`a, b`, `a et b`), never run together as `a,b`. The text lands
 * under `RECORD_TEXT_KEY` beside any the record already carries, which a TEXT
 * site prints and an address site (`href`) never reads.
 */
export const withSystemListText = (
  record: Readonly<Record<string, unknown>>,
  locale: string
): Readonly<Record<string, unknown>> => {
  const lists = Object.entries(record).flatMap(([key, value]) =>
    key !== RECORD_TEXT_KEY && Array.isArray(value)
      ? [[key, storedValueText(value, locale)] as const]
      : []
  )
  if (lists.length === 0) return record
  const carried = record[RECORD_TEXT_KEY]
  const kept = typeof carried === 'object' && carried !== null ? carried : {}
  return { ...record, [RECORD_TEXT_KEY]: { ...kept, ...Object.fromEntries(lists) } }
}
