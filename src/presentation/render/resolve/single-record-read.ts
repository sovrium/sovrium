/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The ONE record a `mode: 'single'` binding draws, read for one visitor — the
 * component-level binding (`resolveSingleMode`) and the page-level one
 * (`resolvePageParentRecord`) alike.
 *
 * A binding with no `filter` reads as it always has
 * ({@link readRecordForCaller}): the route parameter's row, or the first row the
 * visitor may read. A binding WITH a `filter` binds the first row that filter
 * matches, in the binding's `sort` — and, when a route parameter names the row
 * too, the row matching both. A row outside the filter is answered exactly as
 * a row that does not exist: `undefined`, which every caller turns into the
 * page's own not-found. It is read through the same records gate as a list
 * ({@link readRowsForCaller}), so the table's read permission, its row-level
 * rule, the trash and the column mask all still apply.
 *
 * The filter selects which record the binding shows; it is not an access
 * rule. A record it leaves out can still be read wherever the table's own
 * permissions allow it.
 */

import { readRecordForCaller, readRowsForCaller } from './record-read-gate'
import type { DataFilter, DataSort } from '@/domain/models/app/pages/components/data-source'

type ReadRecordInput = Parameters<typeof readRecordForCaller>[0]
type RecordRow = Readonly<Record<string, unknown>>

/** The part of a binding that narrows which record it reads. */
export interface SingleBindingQuery {
  readonly filter?: readonly DataFilter[]
  readonly sort?: readonly DataSort[]
}

/**
 * The binding's record for this visitor, or `undefined` when there is none —
 * see the module header. `binding.filter` must already be concrete: its
 * `$param` and `$currentUser` references resolved.
 */
export async function readBoundRecordForCaller(
  input: ReadRecordInput & { readonly binding: SingleBindingQuery | undefined }
): Promise<RecordRow | undefined> {
  const { binding, at, fields, ...reader } = input
  const filter = binding?.filter ?? []
  if (filter.length === 0) return readRecordForCaller({ ...reader, at, fields })
  const pin: readonly DataFilter[] =
    at === 'first-readable' ? [] : [{ field: at.field, operator: 'eq', value: at.value }]
  const { rows } = await readRowsForCaller({
    ...reader,
    query: {
      filter: [...filter, ...pin],
      ...(binding?.sort !== undefined ? { sort: binding.sort } : {}),
      ...(fields !== undefined ? { fields } : {}),
      pageSize: 1,
      page: 1,
    },
  })
  return rows[0]
}
