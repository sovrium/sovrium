/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useRef } from 'react'
import { writeColumnWidthsToCache } from '../../hooks/use-table-preferences'
import { evaluatePredicate } from './filter-operators'
import type { FilterConjunction, FilterRow } from './use-ui-state'
import type { TableRecord } from '../../shared/types'
import type { AutoSaveConfig } from '@/domain/models/app/pages/components/auto-save'
import type {
  DataTableColumn,
  DataTableGroupBy,
  ComponentSearch,
  DataTableToolbar,
} from '@/domain/models/app/pages/components/component-types/data/data-table/schema'

/**
 * The `?groupBy=` value for one grid: every grouping level, outermost first.
 *
 * All levels ride ONE parameter. A nested group's count has no answer in a
 * response keyed by a single field, and asking once per level would let the
 * answers disagree about the view they describe. A one-level grid produces the
 * bare field name it always sent.
 */
export function buildGroupByParam(groupBy: DataTableGroupBy | undefined): string | undefined {
  if (!groupBy) return undefined
  return [groupBy.field, ...(groupBy.thenBy ?? []).map((level) => level.field)].join(',')
}

/**
 * Ordered list of editable field names from explicit column config.
 * Used by auto-save Tab navigation to find the next editable cell.
 *
 * It reads the SAME `editable` the column defs read, because the
 * permission-derived default is already resolved into `columnConfig` at the
 * island boundary. Re-deriving it here would let Tab navigation and
 * double-click disagree about which cells can be edited.
 */
export function resolveEditableFields(
  columnConfig: readonly DataTableColumn[] | undefined
): readonly string[] {
  if (!columnConfig) return []
  return columnConfig
    .filter((col): col is Extract<DataTableColumn, { field: string }> => 'field' in col)
    .filter((col) => col.editable === true)
    .map((col) => col.field)
}

/** Compute whether the search input should be visible. */
export function shouldShowSearch(
  searchConfig: ComponentSearch | undefined,
  toolbarConfig: DataTableToolbar | undefined
): boolean {
  return !!(
    (searchConfig && searchConfig.enabled !== false) ||
    (toolbarConfig && toolbarConfig.search)
  )
}

/**
 * Resolved save-indicator settings for the data-table view.
 *
 * `show` defaults to true when `autoSave` is configured (saveMode auto/onBlur)
 * unless explicitly disabled; `position` defaults to `inline`.
 */
export interface SaveIndicatorSettings {
  readonly show: boolean
  readonly position: 'inline' | 'toast' | 'toolbar'
}

/**
 * Derive whether (and where) to show the save status indicator.
 *
 * Returns `undefined` when the component has no auto-save behavior, since the
 * indicator only ever reports on auto-save / onBlur persistence.
 */
export function resolveSaveIndicator(
  autoSaveConfig: AutoSaveConfig | undefined
): SaveIndicatorSettings | undefined {
  if (!autoSaveConfig) return undefined
  const mode = autoSaveConfig.saveMode ?? 'manual'
  if (mode === 'manual') return undefined
  // Default: indicator on for auto/onBlur unless explicitly disabled.
  const show = autoSaveConfig.showSaveIndicator !== false
  return { show, position: autoSaveConfig.saveIndicatorPosition ?? 'inline' }
}

/**
 * Apply the runtime filter-builder's `activeFilters` to the server-returned
 * records (PG-03 / [internal ref]).
 *
 * The filter UI is purely client-side state — no round-trip is needed to
 * narrow the visible rows when a filter is committed. With AND conjunction
 * every predicate must match; with OR at least one must match. An empty
 * filter set passes through unchanged.
 *
 * Kept out of the orchestrator so the orchestrator's hook count + complexity
 * stays under the size-limit cap.
 */
export function applyClientFilters(
  records: readonly TableRecord[],
  activeFilters: readonly FilterRow[],
  conjunction: FilterConjunction
): readonly TableRecord[] {
  if (activeFilters.length === 0) return records
  return records.filter((record) => {
    const row = record as Record<string, unknown>
    if (conjunction === 'OR') {
      return activeFilters.some((f) => evaluatePredicate(row[f.field], f.operator, f.value))
    }
    return activeFilters.every((f) => evaluatePredicate(row[f.field], f.operator, f.value))
  })
}

/**
 * Persist resized column widths.
 *
 * TanStack Table emits a `columnSizing` change on every pointer move during
 * a drag. We persist in two tiers:
 *
 * 1. **Synchronous localStorage** (every change) — so the very next
 *    `page.reload()` already sees the new width in the read-through cache,
 * even if the server PATCH hasn't fired yet ([internal ref] reads
 *    `boundingBox()` immediately after `mouse.up()` then reloads).
 * 2. **Debounced server PATCH** (100ms after last change) — collapses a
 *    single drag into a single network call instead of dozens, while still
 *    firing well before realistic cross-device sync windows.
 *
 * Extracted from `useDataTableIslandSetup` to keep that hook's statement
 * count below the size-limits cap.
 */
export function useColumnSizingPersistence(
  tableName: string,
  columnSizing: Record<string, number>,
  updatePreferences: (patch: { readonly columnWidths: Record<string, number> }) => void
) {
  const lastSyncedRef = useRef<string>(JSON.stringify(columnSizing))
  // Shared timer ref across renders — so a re-render that observes the SAME
  // columnSizing doesn't cancel the pending PATCH from the previous change.
  // Using a single ref instead of effect-scoped cleanup avoids the
  // "every re-render kills the timer" footgun.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Timeout type varies between Node/Bun/browser
  const timerRef = useRef<any>(undefined)
  useEffect(() => {
    const serialized = JSON.stringify(columnSizing)
    if (serialized === lastSyncedRef.current) return
    // Don't write an empty object on first paint (no user interaction yet).
    if (Object.keys(columnSizing).length === 0) return
    // eslint-disable-next-line functional/immutable-data -- React ref mutation is the canonical pattern for last-value tracking
    lastSyncedRef.current = serialized
    // Tier 1: synchronous localStorage write (zero latency) — guarantees the
    // very next `page.reload()` sees the new width via `initialData`.
    writeColumnWidthsToCache(tableName, columnSizing)
    // Tier 2: debounced server PATCH (100ms after last change) — collapses
    // a single drag into a single network call. The shared `timerRef` is
    // cleared explicitly when a NEW change arrives, never on re-renders
    // that observe the same value.
    if (timerRef.current) clearTimeout(timerRef.current)
    // eslint-disable-next-line functional/immutable-data -- React ref mutation is the canonical pattern for shared timers
    timerRef.current = setTimeout(() => {
      updatePreferences({ columnWidths: columnSizing })
    }, 100)
  }, [tableName, columnSizing, updatePreferences])
}
