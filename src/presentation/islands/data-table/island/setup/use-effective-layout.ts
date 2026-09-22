/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useDataTableState } from '../../../hooks/use-data-table-state'
import { useSavedViews } from '../../../hooks/use-saved-views'
import { densityToHeight, useTablePreferences } from '../../../hooks/use-table-preferences'
import type { SetupContext } from './setup-params'

export type EffectiveLayout = ReturnType<typeof useEffectiveLayout>

/**
 * Per-user, per-table preferences and the table state they drive.
 *
 * Layout precedence: the APPLIED VIEW wins while it is applied; the
 * per-(user, table) preference is the fallback when the view expresses no
 * opinion. Both halves matter — "view always wins" would satisfy an
 * override-only assertion while silently resetting every user's table-wide
 * density the moment they opened a view that never set one.
 */
export function useEffectiveLayout(ctx: SetupContext) {
  const prefs = useTablePreferences(ctx.tableKey)
  const savedViews = useSavedViews(ctx.tableKey)

  const effectiveRowDensity = ctx.ui.activeViewRowDensity ?? prefs.preferences.rowDensity
  const effectiveColumnWidths = ctx.ui.activeViewColumnWidths ?? prefs.preferences.columnWidths

  // Drive the row height synchronously each render so the first paint after a
  // `page.reload()` already reflects whichever density is in force. With none,
  // the schema's `rowHeight` wins and the in-component toggle keeps working.
  const controlledRowHeight = effectiveRowDensity ? densityToHeight(effectiveRowDensity) : undefined

  const tableState = useDataTableState({
    initialPageSize: ctx.params.paginationConfig?.pageSize ?? 25,
    initialRowHeight: ctx.params.initialRowHeight,
    ...(controlledRowHeight && { controlledRowHeight }),
    ...(effectiveColumnWidths && {
      initialColumnSizing: effectiveColumnWidths,
      controlledColumnSizing: effectiveColumnWidths,
    }),
  })

  return { prefs, savedViews, tableState }
}
