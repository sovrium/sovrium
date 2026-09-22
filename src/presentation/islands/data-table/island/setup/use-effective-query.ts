/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useMemo } from 'react'
import { savedViewFiltersToDataFilters, type SavedView } from '../../../hooks/use-saved-views'
import type { SortRow } from '../use-ui-state'
import type { SetupContext } from './setup-params'
import type { EffectiveLayout } from './use-effective-layout'
import type { SortingState } from '@tanstack/react-table'

export type EffectiveQuery = ReturnType<typeof useEffectiveQuery>

/**
 * Resolve the sort the records request will carry from the TWO stores that can
 * express one.
 *
 * The split is deliberate. It was re-measured on 2026-09-03 against a proposal
 * to collapse `activeSorts` into `state.sorting`, and the two stores hold
 * different things:
 *
 * - `headerSorting` (`state.sorting`) is what a column-header click set.
 * - `activeSorts` is what the multi-sort overlay committed.
 *
 * The overlay OVERRIDES the header without ERASING it, so clearing the overlay
 * falls back to the header's own sort rather than to no sort at all. Writing
 * the overlay straight into `state.sorting` would merge the two stores into
 * one, and clearing the overlay would then emit a DIFFERENT server query — an
 * observable behaviour change, not a refactor.
 *
 * The overlay also offers every entry in `tableFields`, not only the rendered
 * columns, so a resolved entry's `id` is not required to name a column. That is
 * legal only because `manualSorting` is hardcoded `true` and the sorted row
 * model short-circuits before it would resolve one — the same reason grouping
 * is not a registered feature (see `table-features.ts`).
 */
export function resolveEffectiveSorting(
  activeSorts: readonly SortRow[],
  headerSorting: SortingState
): SortingState {
  return activeSorts.length > 0
    ? activeSorts.map((s) => ({ id: s.field, desc: s.direction === 'desc' }))
    : headerSorting
}

/**
 * The filter and sort the records request will actually carry, once the
 * default view and the runtime sort panel have had their say.
 */
export function useEffectiveQuery(ctx: SetupContext, layout: EffectiveLayout) {
  // When the user has a default view set, resolve it from the saved-views list
  // and apply its filters on top of the schema's `dataSource.filter`. The
  // resolution happens AFTER the views query resolves, so the table briefly
  // renders unfiltered before the filtered query supersedes it.
  const activeView: SavedView | undefined =
    layout.prefs.preferences.defaultViewId !== undefined
      ? layout.savedViews.views.find((view) => view.id === layout.prefs.preferences.defaultViewId)
      : undefined

  const viewFilters = savedViewFiltersToDataFilters(activeView?.filters)
  const dataSourceFilter = ctx.params.dataSource.filter
  const filter = useMemo(
    () =>
      viewFilters && viewFilters.length > 0
        ? [...(dataSourceFilter ?? []), ...viewFilters]
        : dataSourceFilter,
    [dataSourceFilter, viewFilters]
  )

  // The runtime multi-sort panel takes precedence over column-header sort, and
  // falls back to it when cleared. `resolveEffectiveSorting` owns that rule and
  // records why the two stores are not merged; the schema's `dataSource.sort`
  // is the last fallback, applied inside the query hook itself.
  const { activeSorts } = ctx.ui
  const headerSorting = layout.tableState.sorting
  const sorting = useMemo(
    () => resolveEffectiveSorting(activeSorts, headerSorting),
    [activeSorts, headerSorting]
  )

  return { activeView, filter, sorting }
}
