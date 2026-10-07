/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A board's drop hooks (`drag.onDrop`): what runs once a card dropped into a
 * column has been SAVED. The first hook whose `when.value` is that column runs
 * with the moved card as `$record` — `openDrawer` opens the named drawer on it,
 * `fill` writes one of its values into a form control on the page. Called only
 * after the write answered OK, so a move that failed to save asks nothing.
 */

import { openCardDrawer } from '../runtime/card-click'
import { fillFromCard } from '../runtime/fill-dispatch'
import type { TableRecord } from '../runtime/types'
import type {
  KanbanDrag,
  KanbanDropHook,
} from '@/domain/models/app/pages/components/component-types/data/kanban/schema'

export function runDropHook(
  drag: KanbanDrag | undefined,
  column: string,
  record: TableRecord,
  table: string | undefined
): void {
  const hook: KanbanDropHook | undefined = drag?.onDrop?.find(
    (entry) => entry.when.value === column
  )
  if (hook === undefined) return
  const { action } = hook
  if ('type' in action) fillFromCard(action, record)
  else openCardDrawer(action.component, record, table)
}
