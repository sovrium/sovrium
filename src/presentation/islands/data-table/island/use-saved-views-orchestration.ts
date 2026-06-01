/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useMemo } from 'react'
import { dispatch as dispatchIslandEvent } from '../../_shared/event-bus'
import {
  useSavedViewActions,
  type SavedView,
  type SavedViewConfigPayload,
} from '../../hooks/use-saved-views'
import type { FilterRow, SortRow } from './use-ui-state'
import type { ViewsMenuEntry } from './views-menu'



interface ResolvedViewPayload {
  readonly filters: readonly FilterRow[]
  readonly sorts: readonly SortRow[]
  readonly groupBy: string | null
}

export function computeViewSnapshot(input: {
  readonly filters: readonly {
    readonly field: string
    readonly operator: string
    readonly value: unknown
  }[]
  readonly sorts: readonly { readonly field: string; readonly direction: 'asc' | 'desc' }[]
  readonly groupBy: string | null
}): string {
  const filters = input.filters.map((f) => ({
    field: f.field,
    operator: f.operator,
    value: f.value,
  }))
  const sorts = input.sorts.map((s) => ({ field: s.field, direction: s.direction }))
  return JSON.stringify({ filters, sorts, groupBy: input.groupBy ?? null })
}

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
  readonly activeFilters: readonly FilterRow[]
  readonly activeSorts: readonly SortRow[]
  readonly runtimeGroupBy: string | null
  readonly baseViewSnapshot: string | null
  readonly activeViewId: string | null
  readonly activeViewSource: 'developer' | 'personal' | null
  readonly deleteViewTarget: { readonly id: string; readonly name: string } | null
  readonly onApplySavedView: (input: {
    readonly id: string
    readonly source: 'developer' | 'personal'
    readonly filters: readonly FilterRow[]
    readonly sorts: readonly SortRow[]
    readonly groupBy: string | null
    readonly snapshot: string
    readonly closeOverlays?: boolean
  }) => void
  readonly onClearActiveView: () => void
}

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

export function useSavedViewsOrchestration(params: OrchestrationParams) {
  const {
    tableName,
    tableViews,
    personalViews,
    activeFilters,
    activeSorts,
    runtimeGroupBy,
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
      }),
    [activeFilters, activeSorts, runtimeGroupBy]
  )

  const canSaveCurrentView =
    activeFilters.length > 0 || activeSorts.length > 0 || runtimeGroupBy !== null
  const isViewModified = baseViewSnapshot !== null && baseViewSnapshot !== currentSnapshot

  const resolveDeveloperPayload = useCallback(
    (id: string): ResolvedViewPayload => {
      const dev = (tableViews ?? []).find((v) => String(v.id) === id)
      return {
        filters: toFilterRows(dev?.filters, 'dev-f'),
        sorts: toSortRows(dev?.sorts, 'dev-s'),
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
        groupBy: personalView?.groupBy ?? null,
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
      })
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
    }),
    [activeFilters, activeSorts, runtimeGroupBy]
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
