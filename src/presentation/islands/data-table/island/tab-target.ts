/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/** Which way Tab is travelling. Shift-Tab is `previous`. */
export type TabDirection = 'next' | 'previous'

/** The cell Tab hands the editor to. */
export interface TabTarget {
  readonly rowId: string
  readonly field: string
}

/**
 * Where Tab takes the open editor.
 *
 * Two properties this has to hold, and they are what the shape below is for.
 *
 * **Tab and Shift-Tab are exact inverses.** Whatever Tab does, Shift-Tab from
 * the destination must land back on the origin — including across a row
 * boundary. That is why both directions run through one function with a signed
 * step rather than through two hand-written traversals that drift apart.
 *
 * **Tab off the end of a row starts the next record**, rather than stopping or
 * escaping to whatever follows the grid. Typing a record is the reason inline
 * editing exists; making the reader reach for the mouse once per row would
 * undo it. The wrap moves to the FIRST editable column of the next row going
 * forwards, and the LAST editable column of the previous row going back —
 * again, inverses.
 *
 * Only EDITABLE columns take part. A read-only column is navigable by arrow
 * key (the cursor is a position, not an edit affordance) but Tab is a commit
 * gesture, so it visits only cells that can accept one.
 *
 * Returns `undefined` at the grid's own edges — Tab out of the last editable
 * cell of the last row leaves the grid, which is what a tab stop is for.
 */
export function resolveTabTarget(params: {
  readonly rowIds: readonly string[]
  readonly editableFields: readonly string[]
  readonly from: TabTarget
  readonly direction: TabDirection
}): TabTarget | undefined {
  const { rowIds, editableFields, from, direction } = params
  const fieldIndex = editableFields.indexOf(from.field)
  const rowIndex = rowIds.indexOf(from.rowId)
  if (fieldIndex < 0 || rowIndex < 0) return undefined

  const step = direction === 'next' ? 1 : -1

  // Still inside this row: the common case, and the only one that does not
  // change record.
  const nextField = editableFields[fieldIndex + step]
  if (nextField !== undefined) return { rowId: from.rowId, field: nextField }

  // Off the end of the row — wrap to the neighbouring record, entering it from
  // the side Tab is travelling towards.
  const wrappedRowId = rowIds[rowIndex + step]
  if (wrappedRowId === undefined) return undefined
  const wrappedField =
    direction === 'next' ? editableFields[0] : editableFields[editableFields.length - 1]
  return wrappedField === undefined ? undefined : { rowId: wrappedRowId, field: wrappedField }
}
