/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { satisfiesFieldCondition } from '@/domain/models/app/tables/condition-operators'
import { computeTableActionRowClasses } from '@/presentation/design/table-default-classes'
import { ActionButton, type ActionControlLabels } from './action-cell'
import { rowIdOf } from './row-identity'
import type { RowActionHandler } from './formatting'
import type { DataTableCellContext } from './island/table-features'
import type { TableRecord } from '../runtime/types'
import type {
  ActionColumn,
  ActionColumnItem,
} from '@/domain/models/app/pages/components/component-types/data/table/schema'

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
 * Builds the per-row cell renderer for an action column. Each action button is
 * first gated by its optional `visibleWhen` predicate (see {@link isActionVisible}),
 * so a button renders only on rows whose named field value satisfies the
 * condition; actions without a predicate render on every row. Each rendered
 * action delegates to {@link ActionButton}, which arms an inline `alertdialog`
 * confirm when the action item carries a `confirm` message (the per-row analog of
 * the bulk-action confirm gate).
 *
 * The renderer is a fresh CLOSURE on every island render, and `flexRender` makes
 * a closure an element type — so every cell this builds is destroyed and rebuilt
 * whenever the grid re-reads itself. That is why an armed confirm is addressed
 * by `confirmKey` and held above the rows: the key is the row identity React
 * already reconciles by, paired with the same ordinal as the child `key`, so a
 * rebuilt cell asks for its gate back under exactly the name it stored it under.
 */
export function buildActionCellRenderer(
  col: ActionColumn,
  onActionClick: RowActionHandler | undefined,
  labels: ActionControlLabels
) {
  return ({ row }: DataTableCellContext) => (
    <div className={computeTableActionRowClasses()}>
      {col.actions
        .filter((action) => isActionVisible(action, row.original))
        .map((action, actionIndex) => (
          <ActionButton
            key={`action-${String(actionIndex)}`}
            confirmKey={`${rowIdOf(row)}::action-${String(actionIndex)}`}
            action={action}
            record={row.original}
            onActionClick={onActionClick}
            labels={labels}
          />
        ))}
    </div>
  )
}
