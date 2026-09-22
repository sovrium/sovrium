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
import type { FieldMetaMap } from '../../hooks/use-inline-editing'
import type { TableRecord } from '../../runtime/types'
import type { AutoSaveConfig } from '@/domain/models/app/pages/components/auto-save'
import type {
  DataTableColumn,
  DataTableGroupBy,
  ComponentSearch,
  DataTableToolbar,
} from '@/domain/models/app/pages/components/component-types/data/table/schema'

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
 * The search settings the toolbar renders from — `search` when the author wrote
 * one, otherwise the defaults implied by `toolbar: { search: true }`.
 *
 * The two declarations are separate blocks that both say "this grid searches",
 * and {@link shouldShowSearch} has always honoured either. The RENDER, however,
 * required the `search` block itself (`showSearch && searchConfig` in
 * `toolbar.tsx`), so `toolbar.search` on its own painted no box at all and
 * `shouldShowSearch`'s second branch could never reach a visible control — a
 * declared capability that did nothing, the same shape as the toolbar-gate
 * defects above it.
 *
 * Resolving here rather than defaulting at the render site keeps ONE answer:
 * the grid decides once whether it searches and with what settings, instead of
 * the visibility gate and the render gate deriving it separately and disagreeing.
 * NO new AppSchema — both blocks already exist; this only stops one of them
 * being inert.
 */
export function resolveSearchConfig(
  searchConfig: ComponentSearch | undefined,
  toolbarConfig: DataTableToolbar | undefined
): ComponentSearch | undefined {
  if (searchConfig) return searchConfig
  return toolbarConfig?.search ? { enabled: true } : undefined
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
 * Whether this grid sorts its own rows instead of asking the server to.
 *
 * TWO conditions, and each excludes a different way a browser-side sort lies.
 *
 * 1. **A system source.** The records API honours `?sort=` on every DB-table
 *    grid, so those have a server that sorts and need nothing here — which is
 *    also what keeps this unable to reach them. A system read endpoint is the
 *    only binding where `?sort=` may be received and ignored, and the
 *    catalogue's own specimen endpoint is exactly that: it returns a
 *    compile-time fixture in authored order, whatever it is asked for.
 * 2. **The whole result set is loaded.** A page is not a view. Sorting the
 *    rows in hand and labelling the header `ascending` would tell the reader
 *    they are looking at the smallest values in the source when they are
 *    looking at the smallest values on their screen — a wrong answer delivered
 *    with the same confidence as a right one, which is worse than the inert
 *    header this replaces.
 *
 * `loadedRows` is the count BEFORE the runtime filter-builder narrows it,
 * because a filter removing rows says nothing about whether the server paged:
 * comparing the narrowed count would switch client sorting off precisely when
 * the reader had narrowed the view enough for it to be cheapest.
 *
 * An endpoint that DOES sort is unharmed: it keeps receiving `?sort=`, returns
 * its rows already in order, and the model re-sorts them by the same key to
 * the same order.
 */
export function resolveClientSorted(
  isSystemSource: boolean,
  loadedRows: number,
  totalRecords: number
): boolean {
  return isSystemSource && loadedRows >= totalRecords
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
 * `fieldMeta` carries the declared field types, and is what tells `equals` on
 * an `assignee` column to compare strings rather than coerce `'Alice'` to
 * `NaN`. It is optional because the predicate degrades safely to the string
 * comparison without it, but the island always has it — pass it.
 *
 * Kept out of the orchestrator so the orchestrator's hook count + complexity
 * stays under the size-limit cap.
 */
export function applyClientFilters(
  records: readonly TableRecord[],
  activeFilters: readonly FilterRow[],
  conjunction: FilterConjunction,
  fieldMeta?: FieldMetaMap
): readonly TableRecord[] {
  if (activeFilters.length === 0) return records
  const matches = (row: Record<string, unknown>, f: FilterRow): boolean =>
    evaluatePredicate(row[f.field], f.operator, f.value, fieldMeta?.[f.field]?.type)
  return records.filter((record) => {
    const row = record as Record<string, unknown>
    if (conjunction === 'OR') return activeFilters.some((f) => matches(row, f))
    return activeFilters.every((f) => matches(row, f))
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
