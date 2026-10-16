/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback } from 'react'
import { executeBulkAction } from '../bulk-action-execute'
import type { SetupContext } from './setup-params'
import type { GridInstance } from './use-grid-table'
import type { RefreshWiring } from './use-refresh-wiring'
import type { DataTableBulkAction } from '@/domain/models/app/pages/components/component-types/data/table/schema'

export type GridActions = ReturnType<typeof useGridActions>

/** A bulk action that deletes the selected rows. */
const isDeleteAction = (action: DataTableBulkAction): boolean =>
  'type' in action.action &&
  action.action.type === 'crud' &&
  (action.action as { readonly operation?: string }).operation === 'delete'

/** The handler the bulk bar invokes. */
export function useGridActions(ctx: SetupContext, grid: GridInstance, refresh: RefreshWiring) {
  const { table } = grid
  const { queryClient } = ctx
  const { queryKey } = refresh
  const strings = ctx.params.uiStrings
  const onBulkExecute = useCallback(
    (action: DataTableBulkAction) => {
      void executeBulkAction(table, action, { queryClient, queryKey, strings }).then((done) => {
        // Deleted rows are gone: a selection still naming them would count
        // rows that no longer exist and offer actions on nothing.
        if (done && isDeleteAction(action)) table.resetRowSelection()
      })
    },
    [table, queryClient, queryKey, strings]
  )

  return { onBulkExecute }
}
