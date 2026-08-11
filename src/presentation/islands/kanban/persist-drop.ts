/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { showSuccessToast } from '../components/crud-form/toast'
import type { KanbanDrag } from '@/domain/models/app/pages/components/component-types/data/kanban/schema'

export interface DragPersistContext {
  readonly drag: KanbanDrag
  readonly groupByField: string
  readonly tableName: string
}

/**
 * Persist a cross-column drop by issuing the configured CRUD update.
 *
 * There is nothing to dispatch on: `drag.persistAction` is typed as
 * `CrudActionSchema`, not the generic `Action` union, so every non-crud variant
 * is refused at config-validation time rather than accepted and ignored here.
 * (An earlier revision of this comment described the pre-narrowing world and
 * listed four ignored variants; the union had eight members, the narrowing had
 * already landed, and neither fact was checked by anything. See
 * `kanban/schema.ts` — `persistAction`.)
 *
 * The single guard below is therefore a residual-gap filter, not a dispatch.
 * Three gaps survive the narrowing because a union cannot express them, and
 * they are the reason a config can still validate and do nothing:
 *   - `operation` must be `update`; a `crud` action with `create` / `delete`
 *     falls through to `{ ok: true }`.
 *   - the PATCH body is hardcoded to the groupBy field, so a configured crud
 *     payload is ignored.
 *   - within-column reorders never reach this function; only cross-column
 *     moves persist.
 *
 * The `complexity` suppression below is 11 against a threshold of 10, spent on
 * that four-condition guard plus the fetch / toast / catch branches — NOT on
 * dispatching across action variants, which is what its previous rationale
 * claimed.
 */
// eslint-disable-next-line complexity -- see the note above: the 11 is the residual-gap guard plus fetch/toast/catch, not an action-type dispatch.
export async function persistKanbanDrop(
  ctx: DragPersistContext,
  recordId: string,
  newGroupValue: string
): Promise<{ readonly ok: boolean }> {
  const action = ctx.drag.persistAction
  if (!action || !('type' in action) || action.type !== 'crud' || action.operation !== 'update') {
    return { ok: true }
  }

  const tableName = action.table || ctx.tableName
  const url = `/api/tables/${tableName}/records/${recordId}`

  try {
    const res = await fetch(url, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [ctx.groupByField]: newGroupValue }),
    })
    if (!res.ok) return { ok: false }

    const successToast = action.onSuccess?.toast
    if (successToast?.message) {
      showSuccessToast({ message: successToast.message, variant: successToast.variant })
    }
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

export function showErrorToast(drag: KanbanDrag): void {
  const action = drag.persistAction
  const errorToast =
    action && 'type' in action && action.type === 'crud' ? action.onError?.toast : undefined
  if (errorToast?.message) {
    showSuccessToast({ message: errorToast.message, variant: errorToast.variant })
  }
}
