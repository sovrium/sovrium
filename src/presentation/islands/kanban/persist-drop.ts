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

export async function persistKanbanDrop(
  ctx: DragPersistContext,
  recordId: string,
  newGroupValue: string
): Promise<{ readonly ok: boolean }> {
  const action = ctx.drag.persistAction
  if (!action || action.type !== 'crud' || action.operation !== 'update') {
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
  const errorToast =
    drag.persistAction?.type === 'crud' ? drag.persistAction.onError?.toast : undefined
  if (errorToast?.message) {
    showSuccessToast({ message: errorToast.message, variant: errorToast.variant })
  }
}
