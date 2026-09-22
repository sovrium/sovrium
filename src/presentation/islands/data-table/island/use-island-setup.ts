/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useQueryClient } from '@tanstack/react-query'
import { useInlineEditing } from '../../hooks/use-inline-editing'
import { buildIslandSetupResult } from './setup/build-setup-result'
import { useEffectiveLayout } from './setup/use-effective-layout'
import { useEffectiveQuery } from './setup/use-effective-query'
import { useGridActions } from './setup/use-grid-actions'
import { buildGridColumns, useGridInstance, useGridRecords } from './setup/use-grid-table'
import { useInlineSaveWiring } from './setup/use-inline-save-wiring'
import { useRecordsQuery } from './setup/use-records-query'
import { useRefreshWiring } from './setup/use-refresh-wiring'
import { useSystemQueryParams } from './setup/use-system-query-params'
import { useViewsSurface } from './setup/use-views-surface'
import { useDataTableUiState } from './use-ui-state'
import type { IslandSetupParams, SetupContext } from './setup/setup-params'

// Re-export the save-indicator settings type from its helper home so the
// existing view import path stays stable.
export type { SaveIndicatorSettings } from './island-setup-helpers'
export type { IslandSetupParams } from './setup/setup-params'

/**
 * Wire all hooks the data-table island needs and return the bag of values the
 * orchestrator hands to `<DataTableView>`.
 *
 * The body is a SEQUENCE, and the sequence is the contract: React identifies a
 * hook by its call order, and several of the steps below additionally consume
 * the step before them. Each line delegates one stage to a sub-hook in
 * `./setup/`, in the order the stages have always run — read it top to bottom
 * and the data flow is the reading order.
 */
export function useDataTableIslandSetup(params: IslandSetupParams) {
  const queryClient = useQueryClient()
  const ui = useDataTableUiState()
  const ctx: SetupContext = {
    params,
    ui,
    queryClient,
    isSystemSource: params.dataSource.system !== undefined,
    tableKey: params.dataSource.table ?? '',
  }

  const layout = useEffectiveLayout(ctx)
  const effective = useEffectiveQuery(ctx, layout)
  const system = useSystemQueryParams(ctx)
  const records = useRecordsQuery(ctx, layout, effective, system)
  const refresh = useRefreshWiring(ctx, layout, records)

  const inlineEditing = useInlineEditing({
    tableName: ctx.tableKey,
    fieldMeta: params.fieldMeta,
    onSave: refresh.handleRefresh,
    autoSave: params.autoSaveConfig,
  })

  const gridRecords = useGridRecords(ctx, records)
  const allColumns = buildGridColumns(ctx, layout, gridRecords, refresh)
  const grid = useGridInstance(ctx, layout, gridRecords, {
    allColumns,
    effective,
    records,
    inlineEditing,
    sortRefusal: refresh.sortRefusal,
  })

  const actions = useGridActions(ctx, layout, grid, refresh)
  const inlineSave = useInlineSaveWiring(ctx, inlineEditing, gridRecords)
  const views = useViewsSurface(ctx, layout)

  return buildIslandSetupResult({
    ctx,
    layout,
    effective,
    records,
    refresh,
    gridRecords,
    allColumns,
    grid,
    actions,
    inlineEditing,
    inlineSave,
    views,
  })
}
