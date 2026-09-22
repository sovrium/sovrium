/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback } from 'react'
import { useIslandSearch } from '../../../hooks/use-island-search'
import { executeBulkAction } from '../bulk-action-execute'
import type { SetupContext } from './setup-params'
import type { EffectiveLayout } from './use-effective-layout'
import type { GridInstance } from './use-grid-table'
import type { RefreshWiring } from './use-refresh-wiring'
import type { RowDensity } from '../../../hooks/use-table-preferences'
import type { DataTableBulkAction } from '@/domain/models/app/pages/components/component-types/data/table/schema'

export type GridActions = ReturnType<typeof useGridActions>

/**
 * The three imperative handlers the toolbar and the bulk bar invoke.
 *
 * They are kept together because their hook order is load-bearing: the
 * external search subscription sits between the two callbacks and has to stay
 * there.
 */
export function useGridActions(
  ctx: SetupContext,
  layout: EffectiveLayout,
  grid: GridInstance,
  refresh: RefreshWiring
) {
  const { prefs } = layout

  // Density select handler — persists to the server-backed prefs row. The
  // density-menu calls this on each menuitem click; the `useEffect` in
  // useDataTableState then mirrors the new `effectiveRowHeight` value back to
  // the local row-height state for the visual switch.
  const onSelectDensity = useCallback(
    (density: RowDensity) => {
      prefs.updatePreferences({ rowDensity: density })
    },
    [prefs]
  )

  useIslandSearch(layout.tableState.setGlobalFilter, ctx.params.searchSourceId)

  const { table } = grid
  const { queryClient } = ctx
  const { queryKey } = refresh
  const onBulkExecute = useCallback(
    (action: DataTableBulkAction) => {
      void executeBulkAction(table, action, { queryClient, queryKey })
    },
    [table, queryClient, queryKey]
  )

  return { onSelectDensity, onBulkExecute }
}
