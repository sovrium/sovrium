/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { DataTableColumn } from '@/domain/models/app/pages/components/component-types/data/table/schema'

type ActionColumn = Extract<DataTableColumn, { readonly type: 'actions' }>

const isActionColumn = (column: DataTableColumn): column is ActionColumn =>
  'type' in column && column.type === 'actions'

/**
 * A row has ONE menu. When a grid draws its row actions as a menu and the
 * reader can see several action columns, their items are drawn in a single
 * column — in the place of the first, items in column order, under the last
 * column's label — so a row never carries two `…` buttons.
 *
 * A column the reader's capability removed is already gone (the server drops
 * it before the island sees the config), so it contributes nothing; a single
 * action column is returned as written.
 */
export function mergeActionColumns(
  columns: readonly DataTableColumn[]
): readonly DataTableColumn[] {
  const actions = columns.filter(isActionColumn)
  if (actions.length < 2) return columns
  const last = actions.at(-1)!
  const merged: ActionColumn = {
    ...last,
    actions: actions.flatMap((column) => column.actions),
  }
  const first = columns.indexOf(actions[0]!)
  return columns.flatMap((column, index): readonly DataTableColumn[] => {
    if (index === first) return [merged]
    return isActionColumn(column) ? [] : [column]
  })
}
