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
import type { DataTableBulkAction } from '@/domain/models/app/pages/components/component-types/data/table/schema'

export type GridActions = ReturnType<typeof useGridActions>

/**
 * The external search subscription, and the handler the bulk bar invokes.
 */
export function useGridActions(
  ctx: SetupContext,
  layout: EffectiveLayout,
  grid: GridInstance,
  refresh: RefreshWiring
) {
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

  return { onBulkExecute }
}
