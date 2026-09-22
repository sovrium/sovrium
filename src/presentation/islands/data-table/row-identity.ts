/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { DataTableRow } from './island/table-features'

/**
 * The identity a rendered row answers to — the value `<tr data-row-id>`
 * carries, the key React reconciles the row by, and the `rowId` half of the
 * cell cursor.
 *
 * ONE expression, because three things have to agree on it or the grid comes
 * apart in ways no type-checker sees: the cursor resolves a `<td>` by
 * `data-row-id`, React moves a row's node on re-order by its key, and the
 * fill handle finds the source record by the cursor's `rowId`. When this was
 * spelled six times over, a spelling that drifted in one place would have
 * left the cursor pointing at a row React had keyed differently.
 *
 * The record's own `id` wins; `row.id` — TanStack's row INDEX, since no
 * `getRowId` is configured — is only the fallback for a record without one.
 */
export const rowIdOf = (row: DataTableRow): string => String(row.original.id ?? row.id)
