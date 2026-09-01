/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { showSuccessToast } from '../components/crud-form/toast'
import type { KanbanDrag } from '@/domain/models/app/pages/components/component-types/data/kanban/schema'

export interface DragPersistContext {
  /**
   * Absent when the board declares no `drag` block. It no longer gates
   * persistence — see {@link persistKanbanDrop} — and now carries only the
   * override: a different target table and the success/error toasts.
   */
  readonly drag: KanbanDrag | undefined
  readonly groupByField: string
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

/**
 * Persist a cross-column drop.
 *
 * A drop writes the target column value to the groupBy field whenever the
 * board is bound to a table. `drag.persistAction` is an OVERRIDE — it may
 * redirect the write to another table and attach success/error toasts — and is
 * no longer the enabler.
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
 *   - the PATCH body is the groupBy field alone, so an override's configured
 *     crud payload is still ignored;
 *   - within-column reorders never reach this function — only cross-column
 *     moves carry a value to write.
 *
 * An unbound board (embedded rows, or a system source) has nowhere to write and
 * reports `{ ok: true }`, leaving the drop visual-only rather than snapping the
 * card back from a save that was never attempted.
 */
export async function persistKanbanDrop(
  ctx: DragPersistContext,
  recordId: string,
  newGroupValue: string
): Promise<{ readonly ok: boolean }> {
  const action = resolveUpdateOverride(ctx.drag)

  const tableName = action?.table || ctx.tableName
  if (!tableName) return { ok: true }

  const url = `/api/tables/${tableName}/records/${recordId}`

  try {
    const res = await fetch(url, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [ctx.groupByField]: newGroupValue }),
    })
    if (!res.ok) return { ok: false }

    const successToast = action?.onSuccess?.toast
    if (successToast?.message) {
      showSuccessToast({ message: successToast.message, variant: successToast.variant })
    }
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

export function showErrorToast(drag: KanbanDrag | undefined): void {
  const action = drag?.persistAction
  const errorToast =
    action && 'type' in action && action.type === 'crud' ? action.onError?.toast : undefined
  if (errorToast?.message) {
    showSuccessToast({ message: errorToast.message, variant: errorToast.variant })
  }
}
