/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useMemo } from 'react'
import {
  useSavedViewActions,
  type SavedView,
  type SavedViewConfigPayload,
} from '../../hooks/use-saved-views'
import { dispatch as dispatchIslandEvent } from '../../runtime/event-bus'
import { DEFAULT_VIEW_TYPE, type FilterRow, type SortRow } from './use-ui-state'
import type { ViewsMenuEntry } from './views-menu'
import type { RowDensity } from '../../hooks/use-table-preferences'
import type { DataTableViewType } from '@/domain/models/app/pages/components/component-types/data/table/schema'

/**
 * Saved-views orchestration (PG-03 / [internal ref]..022).
 *
 * Extracted from `use-island-setup.ts` to keep that file's line count under
 * the 400-line cap (the saved-views surface is ~200 lines of merge / resolve
 * / persist / dispatch logic and naturally lives in its own module).
 *
 * Wires three concerns together:
 *
 *  1. **Merging** developer-configured views (from `app.tables[i].views[]`,
 *     read-only) with personal saved views (from the user-views REST API)
 *     into a single `ViewsMenuEntry[]` the dropdown projects.
 *
 *  2. **Snapshot diffing**: a JSON-stringified `{filters,sorts,groupBy}`
 *     snapshot is captured at apply-time and re-computed each render to drive
 * the modified-indicator.
 *
 *  3. **Mutations + events**: create / overwrite / delete go through the
 *     `useSavedViewActions` mutation hooks; each success dispatches a typed
 * `sovrium:view-*` event so sibling islands can react.
 *
 * The orchestrator (the data-table island setup hook) reads `ui` state +
 * `currentSnapshot` from its own scope and hands them to `useSavedViewsOrchestration`
 * which returns the action callbacks the toolbar consumes.
 */

/**
 * Cycle 6 deferral marker (PG-03 / [internal ref] — URL contract).
 *
 * The `?userView=<id>` URL contract is intentionally **NOT** implemented in
 * Cycle 5. The next cycle (share-views / URL-state) will:
 *
 *  1. Read `?userView` on island mount and hand its id+source to
 *     {@link useSavedViewsOrchestration.onSelectView} BEFORE the default-view
 * auto-load kicks in — URL wins over the user's
 *     default-view preference.
 *  2. Update `?userView` whenever {@link onSelectView} fires so a shared link
 *     captures the active view; clear the param when the user clicks
 *     `Clear all` (via {@link OrchestrationParams.onClearActiveView}).
 *
 * The seam is the `onSelectView` + `onApplySavedView` pair returned here.
 * Cycle 6 will likely wrap them in a thin `useUrlSyncedActiveView` hook
 * co-located with the orchestrator rather than threading `window.location`
 * through this hook directly — that keeps this module DOM-free.
 */

/** Shape returned by {@link resolveViewPayload} and its developer/personal halves. */
interface ResolvedViewPayload {
  readonly filters: readonly FilterRow[]
  readonly sorts: readonly SortRow[]
  readonly groupBy: string | null
  /**
   * Presentation state the view carries. `viewType` is deliberately optional
   * rather than defaulted here: the resolver reports what the view actually
   * said, and the single fallback to `grid` lives in `applySavedView` +
   * `computeViewSnapshot` so the two can never disagree.
   */
  readonly viewType?: DataTableViewType
  readonly rowDensity?: RowDensity
  readonly columnWidths?: Readonly<Record<string, number>>
}

/**
 * Compute a stable, JSON-serialisable snapshot of a view's filter/sort/groupBy
 * payload. Used as the equality token for the modified-indicator
 *: comparing the snapshot at apply-time against the
 * snapshot of the current UI state lets us cheaply diff a multi-row filter +
 * sort payload as a single string equality.
 *
 * Field ordering is canonicalised — `{ filters, sorts, groupBy, viewType }`
 * always in that order — so two shapes that differ only by JS object-key
 * insertion order still hash to the same snapshot.
 *
 * `viewType` participates because switching the view type IS a change to the
 * view the user has open: a board they switched a saved
 * grid into is a modification they can save, and leaving it out of the token
 * would make the `Modified` indicator silently blind to it.
 */
export function computeViewSnapshot(input: {
  readonly filters: readonly {
    readonly field: string
    readonly operator: string
    readonly value: unknown
  }[]
  readonly sorts: readonly { readonly field: string; readonly direction: 'asc' | 'desc' }[]
  readonly groupBy: string | null
  readonly viewType?: DataTableViewType
}): string {
  const filters = input.filters.map((f) => ({
    field: f.field,
    operator: f.operator,
    value: f.value,
  }))
  const sorts = input.sorts.map((s) => ({ field: s.field, direction: s.direction }))
  return JSON.stringify({
    filters,
    sorts,
    // eslint-disable-next-line unicorn/no-null -- JSON snapshot contract: explicit `null` keeps the stringified key present so two no-group-by states hash identically
    groupBy: input.groupBy ?? null,
    // A view saved without a `viewType` restores as the grid, so it must hash
    // as the grid too — otherwise applying a legacy view would read as
    // `Modified` the instant it landed.
    viewType: input.viewType ?? DEFAULT_VIEW_TYPE,
  })
}

/**
 * Project a saved view's presentation state, reported exactly as the view
 * stored it. Absent keys stay absent: the single fallback to `grid` lives in
 * `applySavedView` + `computeViewSnapshot`, so the two can never disagree, and
 * an absent density means "inherit the user's own preference".
 */
const readPresentationState = (view: SavedView | undefined): Partial<ResolvedViewPayload> => ({
  ...(view?.viewType && { viewType: view.viewType }),
  ...(view?.rowDensity && { rowDensity: view.rowDensity }),
  ...(view?.columnWidths && { columnWidths: view.columnWidths }),
})

/** Inputs the orchestrator passes in from its scope. */
interface OrchestrationParams {
  readonly tableName: string
  readonly tableViews?: ReadonlyArray<{
    readonly id: string
    readonly name: string
    readonly filters?: SavedViewConfigPayload['filters']
    readonly sorts?: SavedViewConfigPayload['sorts']
    readonly groupBy?: string | null
  }>
  readonly personalViews: readonly SavedView[]
  /** Current authored filter rows (`useDataTableUiState.activeFilters`). */
  readonly activeFilters: readonly FilterRow[]
  /** Current authored sort rows. */
  readonly activeSorts: readonly SortRow[]
  /** Current runtime group-by selection. */
  readonly runtimeGroupBy: string | null
  /** Currently-rendered view type — part of the snapshot the indicator diffs. */
  readonly activeView: DataTableViewType
  /** Snapshot of the view in effect at apply-time; null when no view is loaded. */
  readonly baseViewSnapshot: string | null
  /** Currently-loaded view id (developer or personal); null when none loaded. */
  readonly activeViewId: string | null
  /** Discriminator for the currently-loaded view's source. */
  readonly activeViewSource: 'developer' | 'personal' | null
  /** Target of the open delete-view confirmation dialog. */
  readonly deleteViewTarget: { readonly id: string; readonly name: string } | null
  /** Apply a resolved view payload to the UI state (matches `useDataTableUiState.applySavedView`). */
  readonly onApplySavedView: (input: {
    readonly id: string
    readonly source: 'developer' | 'personal'
    readonly filters: readonly FilterRow[]
    readonly sorts: readonly SortRow[]
    readonly groupBy: string | null
    /** Presentation state the view carries; absent = inherit the user's prefs. */
    readonly viewType?: DataTableViewType
    readonly rowDensity?: RowDensity
    readonly columnWidths?: Readonly<Record<string, number>>
    readonly snapshot: string
    readonly closeOverlays?: boolean
  }) => void
  /** Clear the active-view tracking (`useDataTableUiState.clearActiveView`). */
  readonly onClearActiveView: () => void
}

/**
 * Translate a saved-view filter payload (API vocabulary, `value: unknown`) into
 * the FilterRow shape the runtime UI consumes. Unknown values stringify so
 * the filter-builder panel can render them in a text `<input>`.
 */
function toFilterRows(
  filters: SavedViewConfigPayload['filters'] | undefined,
  prefix: string
): readonly FilterRow[] {
  return (filters ?? []).map((f, i) => ({
    id: `${prefix}-${i}`,
    field: f.field,
    operator: f.operator,
    value: typeof f.value === 'string' ? f.value : String(f.value ?? ''),
  }))
}

/** Translate a saved-view sort payload into SortRow shape. */
function toSortRows(
  sorts: SavedViewConfigPayload['sorts'] | undefined,
  prefix: string
): readonly SortRow[] {
  return (sorts ?? []).map((s, i) => ({
    id: `${prefix}-${i}`,
    field: s.field,
    direction: s.direction,
  }))
}

// eslint-disable-next-line max-lines-per-function -- composition of merge + 4 action callbacks; further extraction would just split a single concern into more files
export function useSavedViewsOrchestration(params: OrchestrationParams) {
  const {
    tableName,
    tableViews,
    personalViews,
    activeFilters,
    activeSorts,
    runtimeGroupBy,
    activeView,
    baseViewSnapshot,
    activeViewId,
    activeViewSource,
    deleteViewTarget,
    onApplySavedView,
    onClearActiveView,
  } = params
  const viewActions = useSavedViewActions(tableName)

  const viewEntries: ReadonlyArray<ViewsMenuEntry> = useMemo(() => {
    const dev: ViewsMenuEntry[] = (tableViews ?? []).map((v) => ({
      id: String(v.id),
      name: v.name,
      source: 'developer' as const,
    }))
    const personal: ViewsMenuEntry[] = personalViews.map((v) => ({
      id: v.id,
      name: v.name,
      source: 'personal' as const,
    }))
    return [...dev, ...personal]
  }, [tableViews, personalViews])

  const currentSnapshot = useMemo(
    () =>
      computeViewSnapshot({
        filters: activeFilters,
        sorts: activeSorts,
        groupBy: runtimeGroupBy,
        viewType: activeView,
      }),
    [activeFilters, activeSorts, runtimeGroupBy, activeView]
  )

  // A non-grid view type is on its own worth saving: the user switched a plain
  // table to a board, and that is the whole content of the view they want to
  // keep. Gating `Save view` on filters/sorts alone would leave the button
  // disabled on exactly the surface this feature exists to persist.
  const canSaveCurrentView =
    activeFilters.length > 0 ||
    activeSorts.length > 0 ||
    runtimeGroupBy !== null ||
    activeView !== DEFAULT_VIEW_TYPE
  const isViewModified = baseViewSnapshot !== null && baseViewSnapshot !== currentSnapshot

  const resolveDeveloperPayload = useCallback(
    (id: string): ResolvedViewPayload => {
      const dev = (tableViews ?? []).find((v) => String(v.id) === id)
      return {
        filters: toFilterRows(dev?.filters, 'dev-f'),
        sorts: toSortRows(dev?.sorts, 'dev-s'),
        // eslint-disable-next-line unicorn/no-null -- ResolvedViewPayload.groupBy is `string | null` (mirrors the persisted view config + JSON snapshot contract)
        groupBy: dev?.groupBy ?? null,
      }
    },
    [tableViews]
  )

  const resolvePersonalPayload = useCallback(
    (id: string): ResolvedViewPayload => {
      const personal = personalViews.find((v) => v.id === id)
      const personalView = personal as (SavedView & { groupBy?: string | null }) | undefined
      return {
        filters: toFilterRows(personal?.filters, 'psn-f'),
        sorts: toSortRows(personal?.sorts, 'psn-s'),
        // eslint-disable-next-line unicorn/no-null -- ResolvedViewPayload.groupBy is `string | null` (mirrors the persisted view config + JSON snapshot contract)
        groupBy: personalView?.groupBy ?? null,
        ...readPresentationState(personal),
      }
    },
    [personalViews]
  )

  const resolveViewPayload = useCallback(
    (entry: ViewsMenuEntry): ResolvedViewPayload =>
      entry.source === 'developer'
        ? resolveDeveloperPayload(entry.id)
        : resolvePersonalPayload(entry.id),
    [resolveDeveloperPayload, resolvePersonalPayload]
  )

  const onSelectView = useCallback(
    (entry: ViewsMenuEntry) => {
      const payload = resolveViewPayload(entry)
      const snapshot = computeViewSnapshot({
        filters: payload.filters.map((f) => ({
          field: f.field,
          operator: f.operator,
          value: f.value,
        })),
        sorts: payload.sorts.map((s) => ({ field: s.field, direction: s.direction })),
        groupBy: payload.groupBy,
        ...(payload.viewType && { viewType: payload.viewType }),
      })
      // Selecting from the Views menu = user wants a fresh take on the view,
      // so close any open filter/sort overlay panels (so the toolbar's
      // Filter/Sort buttons are unambiguous matches for the spec's role
      // queries).
      onApplySavedView({
        id: entry.id,
        source: entry.source,
        ...payload,
        snapshot,
        closeOverlays: true,
      })
      dispatchIslandEvent('sovrium:view-applied', {
        table: tableName,
        viewId: entry.id,
        source: entry.source,
      })
    },
    [tableName, resolveViewPayload, onApplySavedView]
  )

  const buildPayloadFromCurrentState = useCallback(
    (): SavedViewConfigPayload => ({
      filters: activeFilters.map((f) => ({
        field: f.field,
        operator: f.operator,
        value: f.value,
      })),
      sorts: activeSorts.map((s) => ({ field: s.field, direction: s.direction })),
      groupBy: runtimeGroupBy,
      // The shape the user is looking at right now travels with the predicate:
      // a view saved while the board is open must restore as a board.
      viewType: activeView,
    }),
    [activeFilters, activeSorts, runtimeGroupBy, activeView]
  )

  const onSaveNewView = useCallback(
    async (name: string) => {
      const config = buildPayloadFromCurrentState()
      const created = await viewActions.createView({ name, config })
      onApplySavedView({
        id: created.id,
        source: 'personal',
        filters: activeFilters,
        sorts: activeSorts,
        groupBy: runtimeGroupBy,
        viewType: activeView,
        snapshot: currentSnapshot,
      })
      dispatchIslandEvent('sovrium:view-saved', {
        table: tableName,
        viewId: created.id,
        name: created.name,
        operation: 'create',
      })
    },
    [
      buildPayloadFromCurrentState,
      currentSnapshot,
      tableName,
      viewActions,
      onApplySavedView,
      activeFilters,
      activeSorts,
      runtimeGroupBy,
      activeView,
    ]
  )

  const onSaveModifiedView = useCallback(() => {
    if (activeViewId === null || activeViewSource !== 'personal') return
    const viewId = activeViewId
    const config = buildPayloadFromCurrentState()
    void viewActions
      .updateView({ viewId, config })
      .then((updated) => {
        onApplySavedView({
          id: updated.id,
          source: 'personal',
          filters: activeFilters,
          sorts: activeSorts,
          groupBy: runtimeGroupBy,
          viewType: activeView,
          snapshot: currentSnapshot,
        })
        dispatchIslandEvent('sovrium:view-saved', {
          table: tableName,
          viewId: updated.id,
          name: updated.name,
          operation: 'update',
        })
      })
      .catch(() => {
        // Errors propagate through the mutation's rejection; future work:
        // render a toast (mirror the conflict-toast pattern).
      })
  }, [
    activeViewId,
    activeViewSource,
    buildPayloadFromCurrentState,
    currentSnapshot,
    tableName,
    viewActions,
    onApplySavedView,
    activeFilters,
    activeSorts,
    runtimeGroupBy,
    activeView,
  ])

  const onConfirmDeleteView = useCallback(async () => {
    const target = deleteViewTarget
    if (!target) return
    await viewActions.deleteView(target.id)
    if (activeViewId === target.id) onClearActiveView()
    dispatchIslandEvent('sovrium:view-deleted', {
      table: tableName,
      viewId: target.id,
    })
  }, [tableName, deleteViewTarget, viewActions, activeViewId, onClearActiveView])

  return {
    viewEntries,
    canSaveCurrentView,
    isViewModified,
    onSelectView,
    onSaveNewView,
    onSaveModifiedView,
    onConfirmDeleteView,
  }
}
