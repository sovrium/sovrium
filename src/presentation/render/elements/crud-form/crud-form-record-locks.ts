/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { lockedOnRecord, nextValuesOf, recordLocked } from '@/presentation/design/locks-verdict'
import type { ResolvedFieldDef } from './crud-form-types'

/**
 * The fields of an UPDATE form as the record's business rules leave them
 * (`_locks`, judged by the server for this reader): a field a lock holds is
 * drawn disabled with the lock's message — or, when a lock closes the whole
 * record, disabled alone, the form saying why once above its fields — and a
 * field a transition moves offers only the value it holds and the values it
 * may move to. A hint only —
 * the save is judged again, and a refusal lands beside the field it names.
 */
export function applyRecordLocks(
  defs: readonly ResolvedFieldDef[],
  record: Readonly<Record<string, unknown>>
): readonly ResolvedFieldDef[] {
  const closed = recordLocked(record) !== undefined
  return defs.map((def) => {
    const lock = lockedOnRecord(record, def.name)
    if (lock !== undefined) {
      return {
        ...def,
        disabled: true,
        ...(closed || lock.reason === undefined ? {} : { lockReason: lock.reason }),
      }
    }
    const next = nextValuesOf(record, def.name)
    if (next === undefined || def.options === undefined) return def
    const current = String(record[def.name] ?? '')
    const options = def.options.filter(
      (option) => option.value === current || next.includes(option.value)
    )
    return { ...def, options }
  })
}
