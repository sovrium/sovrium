/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback } from 'react'
import { computeViewSnapshot } from './use-saved-views-orchestration'
import { useUrlSyncedActiveView } from './use-url-synced-active-view'
import type { useDataTableUiState, FilterRow, SortRow } from './use-ui-state'

/** The view payload a `?userView=<id>` share link resolves to. */
interface SharedView {
  readonly id: string
  readonly filters: readonly FilterRow[]
  readonly sorts: readonly SortRow[]
  readonly groupBy: string | null
}

/**
 * PG-03 / [internal ref]..026 — keep the grid and the URL agreeing about
 * which saved view is active.
 *
 * Reads `?userView=<id>` on mount, fetches the view through the cross-table
 * share endpoint, and applies it via the SAME `ui.applySavedView` seam the Views
 * menu uses; then keeps the URL in step as the user moves between views (writing
 * on `sovrium:view-applied`, stripping on `sovrium:view-deleted`).
 *
 * The adapter recomputes the base snapshot exactly as
 * `useSavedViewsOrchestration.onSelectView` does. That is not incidental: the
 * "view modified" indicator is a diff against that snapshot, so a view arriving
 * by share link without one would read as modified the instant it loaded.
 */
export function useSharedViewSync(
  tableName: string,
  applySavedView: ReturnType<typeof useDataTableUiState>['applySavedView']
): void {
  const onApplySharedView = useCallback(
    (input: SharedView) => {
      const snapshot = computeViewSnapshot({
        filters: input.filters.map((f) => ({
          field: f.field,
          operator: f.operator,
          value: f.value,
        })),
        sorts: input.sorts.map((s) => ({ field: s.field, direction: s.direction })),
        groupBy: input.groupBy,
      })
      applySavedView({
        id: input.id,
        source: 'personal',
        filters: input.filters,
        sorts: input.sorts,
        groupBy: input.groupBy,
        snapshot,
        closeOverlays: true,
      })
    },
    [applySavedView]
  )
  useUrlSyncedActiveView({ tableName, onApplySharedView })
}
