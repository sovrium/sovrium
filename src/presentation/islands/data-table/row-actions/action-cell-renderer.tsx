/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { satisfiesFieldCondition } from '@/domain/models/app/tables/condition-match-service'
import { computeTableActionRowClasses } from '@/presentation/design/table-default-classes'
import { rowIdOf } from '../row-identity'
import { isInlineAccountAction } from './account-action-kind'
import { ActionButton } from './action-button'
import { RowActionsMenu } from './row-actions-menu'
import { claimRowFocus } from './trigger-focus'
import type { TableRecord } from '../../runtime/types'
import type { DataTableCellContext } from '../island/table-features'
import type { ActionColumnItem } from '@/domain/models/app/pages/components/component-types/data/table/schema'
import type { ReactElement } from 'react'

/**
 * The grid's row-action cell: the actions a row shows, and the edit-mode
 * save and cancel pair.
 */

/**
 * Evaluates an action item's optional `visibleWhen` predicate against a row,
 * via the shared domain matcher — the same one a `button` field's
 * `visibleWhen` spends, so the two cannot drift.
 */
function isActionVisible(action: ActionColumnItem, record: TableRecord): boolean {
  return satisfiesFieldCondition(action.visibleWhen, record)
}

// ---------------------------------------------------------------------------
// Column mapping: Domain config → TanStack Table ColumnDef
// ---------------------------------------------------------------------------

/** Platform-default (English) fallbacks when the host supplies no labels. */
export const DEFAULT_SAVE_LABEL = 'Save'
export const DEFAULT_CANCEL_LABEL = 'Cancel'

/**
 * The row as a reader knows it, for the name of its actions menu: the value of
 * its first field column when that is a text or a number, else its 1-based
 * position on the page.
 */
function rowNameOf(row: DataTableCellContext['row']): string | number {
  const cell = row.getVisibleCells().find((each) => each.column.columnDef.meta?.field !== undefined)
  const value: unknown = cell?.getValue()
  if (typeof value === 'number') return String(value)
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : row.index + 1
}

/**
 * The cell of an action column. Each action button is first gated by its
 * optional `visibleWhen` predicate (see {@link isActionVisible}), so a button
 * renders only on rows whose named field value satisfies the condition;
 * actions without a predicate render on every row. Each rendered action
 * delegates to {@link ActionButton} (`display: inline`), or the shown actions
 * collapse into one {@link RowActionsMenu} (`display: menu`); either way a
 * `confirm` action asks first in a modal alert dialog.
 *
 * ONE function for every action column, reading its column from the meta:
 * `flexRender` makes whatever it is handed an element TYPE, so a closure built
 * per island render would destroy and rebuild every action cell whenever the
 * grid re-reads itself, closing a row's open `…` menu under the reader the
 * moment a refetch lands. An armed confirm
 * is still addressed by `confirmKey` and held above the rows, which keeps it
 * across a cell the grid does unmount (a row leaving the page).
 */
export function RowActionCell({ row, column }: DataTableCellContext): ReactElement | null {
  const config = column.columnDef.meta?.rowActions
  if (config === undefined) return null
  const { col, onActionClick, labels, display } = config
  const rowId = rowIdOf(row)
  // The ordinal is the action's place in the column, not among the shown
  // ones, so a key names the same action whichever of its neighbours hide.
  const shown = col.actions
    .map((action, index) => ({ action, key: `${rowId}::action-${String(index)}` }))
    .filter(({ action }) => isActionVisible(action, row.original))
  const shownKeys = shown.map(({ key }) => key)
  // In a menu, an account control (a role or a passkey picker) still sits in
  // the row: it IS a control, not a command a menu item could stand for.
  const menu =
    display === 'menu' && onActionClick !== undefined
      ? shown.filter(({ action }) => !isInlineAccountAction(action))
      : []
  const inline = menu.length > 0 ? shown.filter((entry) => !menu.includes(entry)) : shown
  return (
    <div
      ref={(node) => claimRowFocus(rowId, shownKeys, node)}
      className={computeTableActionRowClasses()}
    >
      {inline.map(({ action, key }) => (
        <ActionButton
          key={key}
          confirmKey={key}
          action={action}
          record={row.original}
          onActionClick={onActionClick}
          labels={labels}
        />
      ))}
      {menu.length > 0 && onActionClick && (
        <RowActionsMenu
          shown={menu}
          record={row.original}
          onActionClick={onActionClick}
          labels={labels}
          columnLabel={col.label}
          rowName={rowNameOf(row)}
        />
      )}
    </div>
  )
}
