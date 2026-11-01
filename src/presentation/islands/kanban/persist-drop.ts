/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { refusalMessageOf } from '../runtime/refusal-message'
import { renderToast, showSuccessToast } from '../runtime/toast'
import type { TableRecord } from '../runtime/types'
import type { KanbanDrag } from '@/domain/models/app/pages/components/component-types/data/kanban/schema'

export interface DragPersistContext {
  /**
   * Absent when the board declares no `drag` block. It no longer gates
   * persistence — see {@link persistKanbanDrop} — and now carries only the
   * override: a different target table and the success/error toasts.
   */
  readonly drag: KanbanDrag | undefined
  readonly tableName: string
}

/**
 * Narrow `drag.persistAction` to the one variant that overrides the write.
 *
 * `persistAction` is typed as `CrudActionSchema`, not the generic `Action`
 * union, so every non-crud variant is refused at config-validation time rather
 * than accepted and ignored here. What survives the narrowing and still has to
 * be filtered is the `operation`: a `crud` action declaring `create` or
 * `delete` has no meaning over a drop, so it contributes no override and the
 * drop persists against the bound table like any other.
 */
function resolveUpdateOverride(drag: KanbanDrag | undefined) {
  const action = drag?.persistAction
  if (!action || !('type' in action) || action.type !== 'crud' || action.operation !== 'update') {
    return undefined
  }
  return action
}

/** What a drop's write answered: whether it saved, the refusal's sentence, the record as stored. */
export interface DropOutcome {
  readonly ok: boolean
  readonly refusal?: string | undefined
  /** After a refusal, the record as the database holds it now, its `fields` flattened. */
  readonly stored?: TableRecord | undefined
}

/**
 * The record as the database holds it, read again after a refused drop: the
 * board may have drawn it from a state that has since moved (a colleague's
 * write), and the card must land where the record is, drawn from its `_locks`
 * as they now are. `undefined` when it cannot be read.
 */
async function readStoredRecord(url: string): Promise<TableRecord | undefined> {
  try {
    const res = await fetch(url, { credentials: 'include' })
    if (!res.ok) return undefined
    const { fields, ...rest } = (await res.json()) as TableRecord & {
      readonly fields?: TableRecord
    }
    return { ...rest, ...(fields ?? {}) }
  } catch {
    return undefined
  }
}

/**
 * Persist a drop.
 *
 * A drop writes the values its target names whenever the board is bound to a
 * table: the groupBy field on a single-axis board, and on a two-axis board the
 * groupBy field, the swimlane field, or BOTH — one drop is one move, so a
 * diagonal drag that crosses a column boundary and a lane boundary at once is
 * ONE request carrying both changes rather than two racing each other.
 * `drag.persistAction` is an OVERRIDE — it may redirect the write to another
 * table and attach success/error toasts — and is no longer the enabler.
 *
 * It used to be. A board with `drag: { enabled: true }` and no `persistAction`
 * returned `{ ok: true }` here having written nothing, so the card animated
 * into its new column, the row kept its old value, and the move reappeared
 * undone on the next load. Nothing surfaced the discard. That is the failure
 * users file as a bug, and no comparable product gates a board drag behind a
 * per-component action: Airtable, Notion, Baserow, NocoDB, monday.com, ClickUp
 * and Trello all persist a drop immediately.
 *
 * Two gaps remain, and both are deliberate:
 *   - the PATCH body is the axis fields the drop moved across, so an override's
 *     configured crud payload is still ignored;
 *   - within-column reorders never reach this function — only cross-column
 *     moves carry a value to write.
 *
 * A refused write answers the record as it is stored now, read again, so the
 * card goes back to the lane the record holds rather than the one it left.
 *
 * An unbound board (embedded rows, or a system source) has nowhere to write and
 * reports `{ ok: true }`, leaving the drop visual-only rather than snapping the
 * card back from a save that was never attempted.
 */
export async function persistKanbanDrop(
  ctx: DragPersistContext,
  recordId: string,
  updates: Readonly<Record<string, string>>
): Promise<DropOutcome> {
  const action = resolveUpdateOverride(ctx.drag)

  const tableName = action?.table || ctx.tableName
  if (!tableName) return { ok: true }

  const url = `/api/tables/${tableName}/records/${recordId}`

  try {
    const res = await fetch(url, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    // A refusal carrying a sentence — a table rule's message — is shown as it is.
    if (!res.ok) {
      const refusal = await refusalMessageOf(res)
      return { ok: false, refusal, stored: await readStoredRecord(url) }
    }

    const successToast = action?.onSuccess?.toast
    if (successToast?.message) {
      showSuccessToast({ message: successToast.message, variant: successToast.variant })
    }
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

export function showErrorToast(drag: KanbanDrag | undefined, refusal?: string): void {
  if (refusal !== undefined) {
    renderToast(refusal, 'error')
    return
  }
  const action = drag?.persistAction
  const errorToast =
    action && 'type' in action && action.type === 'crud' ? action.onError?.toast : undefined
  if (errorToast?.message) {
    showSuccessToast({ message: errorToast.message, variant: errorToast.variant })
  }
}
