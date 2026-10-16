/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Component, ComponentOfType } from '@/domain/models/app/pages/components'

/**
 * The three render-time WRITE gates a bound grid hands its island — create,
 * update, delete — read off the `_can*` stamps the data-source resolver put in
 * its props (`write-permission-gates.ts`), where the session is known and the
 * island's is not.
 *
 * - `canCreate` offers the trailing add-row line only when the role may create
 *  . Absent (no auth configured) → offered.
 * - `canUpdate` is the permission-derived DEFAULT of a column's `editable`; an explicit `editable` still wins both ways, and
 *   absent (no auth, no `update` grant) the grid is read-only.
 * - `canDelete` offers Delete on the selection in the bottom bar only when the
 *   role may delete. Absent (no auth configured) → offered.
 *
 * A grid declared `readOnly` is a reading for every reader: all three are
 * closed. Presentation only — the records API answers as before.
 *
 * A grid whose every field column is DECLARED `editable: false` — a records
 * explorer deriving its columns from the table, whose rows are edited in the
 * record drawer only — takes no typed row either. Read off the authored columns,
 * before the reader's own write grants lock any of them: a reader who may create
 * but not update still gets the add-row on an ordinary grid.
 */
export function gridWriteGates(
  component: ComponentOfType<'table'>,
  componentProps: Component['props']
): {
  readonly canCreate: boolean | undefined
  readonly canUpdate: boolean | undefined
  readonly canDelete: boolean | undefined
} {
  const stamps = componentProps as
    | {
        readonly _canCreate?: boolean
        readonly _canUpdate?: boolean
        readonly _canDelete?: boolean
      }
    | undefined
  const closed = component.readOnly === true
  return {
    canCreate: closed || everyColumnLocked(component.columns) ? false : stamps?._canCreate,
    canUpdate: closed ? false : stamps?._canUpdate,
    canDelete: closed ? false : stamps?._canDelete,
  }
}

/** Every field column the grid declares says `editable: false`. */
function everyColumnLocked(columns: unknown): boolean {
  if (!Array.isArray(columns)) return false
  const fields = columns.filter(
    (column): column is { readonly editable?: unknown } =>
      typeof column === 'object' && column !== null && 'field' in column
  )
  return fields.length > 0 && fields.every((column) => column.editable === false)
}
