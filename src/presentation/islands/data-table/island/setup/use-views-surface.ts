/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useMemo } from 'react'
import { useSavedViewsOrchestration } from '../use-saved-views-orchestration'
import { useSharedViewSync } from '../use-shared-view-sync'
import type { SetupContext } from './setup-params'
import type { EffectiveLayout } from './use-effective-layout'

export type ViewsSurface = ReturnType<typeof useViewsSurface>

/**
 * The saved-views surface: the merged developer + personal view list, the
 * modified-indicator diff, and the URL sync that applies a shared view link.
 */
export function useViewsSurface(ctx: SetupContext, layout: EffectiveLayout) {
  const { ui, tableKey } = ctx
  const headerSorting = layout.tableState.sorting

  // The "current sort state" the modified-indicator compares against the view
  // snapshot must observe BOTH `ui.activeSorts` (runtime multi-sort panel) AND
  // `tableState.sorting` (column-header sort), because clicking a column header
  // is a modification regardless of channel. When `activeSorts` is non-empty it
  // wins; otherwise we fall back to `tableState.sorting` in SortRow shape.
  const { activeSorts } = ui
  const effectiveSortRows = useMemo(
    () =>
      activeSorts.length > 0
        ? activeSorts
        : headerSorting.map((s, i) => ({
            id: `hdr-${i}`,
            field: s.id,
            direction: s.desc ? ('desc' as const) : ('asc' as const),
          })),
    [activeSorts, headerSorting]
  )

  const orchestration = useSavedViewsOrchestration({
    tableName: tableKey,
    tableViews: ctx.params.tableViews,
    personalViews: layout.savedViews.views,
    activeFilters: ui.activeFilters,
    activeSorts: effectiveSortRows,
    runtimeGroupBy: ui.runtimeGroupBy,
    activeView: ui.activeView,
    baseViewSnapshot: ui.baseViewSnapshot,
    activeViewId: ui.activeViewId,
    activeViewSource: ui.activeViewSource,
    deleteViewTarget: ui.deleteViewTarget,
    onApplySavedView: ui.applySavedView,
    onClearActiveView: ui.clearActiveView,
  })

  // Reads `?userView=<id>` on mount, fetches the view via the cross-table share
  // endpoint, and applies it through the same `ui.applySavedView` seam the
  // orchestrator uses for menu-driven selection. Also keeps the URL in sync as
  // the user navigates between views.
  useSharedViewSync(tableKey, ui.applySavedView)

  // Saved/user views are a DB-table-only feature — never offered for a system
  // source (there is no table id to key personal views on).
  const enabled = !ctx.isSystemSource && ctx.params.toolbarConfig?.views === true

  return { orchestration, enabled }
}
