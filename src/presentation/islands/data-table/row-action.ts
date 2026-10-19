/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { substituteRecordVars } from '@/domain/models/app/pages/substitute-record-vars'
import { dispatch as dispatchIslandEvent } from '../runtime/event-bus'
import { followAddress } from '../runtime/follow-address'
import { rowListWindow, siblingRowIds } from './row-identity'
import { seekFromRow } from './row-seek'
import type { DataRowContext } from './data-row-types'
import type { DataTableRow } from './island/table-features'

/** What a row's action reads off its grid: the declared action, the table, the selection mode. */
export type RowActionContext = Pick<
  DataRowContext,
  'onRowClickAction' | 'tableName' | 'selectionMode'
>

/**
 * Row-click `path` interpolation: `$record.<field>` tokens in the configured
 * path are substituted against the clicked row's data via the shared
 * `substituteRecordVars` helper (unknown / null fields collapse to an empty
 * string so a misconfigured path is still navigable rather than silently
 * retaining the literal `$record.id` token). A `seek` moves a player on the
 * page to the moment the row holds.
 */
export function performRowAction(row: DataTableRow, ctx: RowActionContext, target?: Element): void {
  const action = ctx.onRowClickAction
  // Schema-driven onRowClick wins over single-select toggle (the checkbox still selects).
  if (action?.type === 'navigate') {
    const resolved = substituteRecordVars(action.path, row.original)
    followAddress(resolved, { openInNewTab: action.openInNewTab })
    return
  }
  // PG-04: openSheet dispatch — `sovrium:open-drawer` for the named drawer,
  // carrying the clicked row's record and the ids of the rows on screen, in
  // their order, for the drawer's Previous / Next — and where that page sits in
  // the whole list, for its `n of N`.
  if (action?.type === 'openSheet') {
    dispatchIslandEvent('sovrium:open-drawer', {
      id: action.component,
      record: row.original,
      siblings: siblingRowIds(target),
      ...rowListWindow(target),
      // A system-backed grid has no table: its name is `''`, which would match
      // no form at all, so it names none and the drawer binds as before.
      ...(ctx.tableName ? { table: ctx.tableName } : {}),
    })
    return
  }
  if (action?.type === 'seek') return seekFromRow(action, row)
  if (ctx.selectionMode !== 'single') return
  // For single selection, deselect all others and toggle this row
  row.toggleSelected(!row.getIsSelected())
}
