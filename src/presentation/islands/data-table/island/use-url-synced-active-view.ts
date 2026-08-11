/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useRef } from 'react'
import { subscribe as subscribeIslandEvent } from '../../_shared/event-bus'
import type { FilterRow, SortRow } from './use-ui-state'

/**
 * URL-state sync for the active saved view (PG-03 / [internal ref]..026).
 *
 * Two-way binding between the data-table's runtime active-view state and the
 * `?userView=<id>` URL query param:
 *
 *  1. **URL → state (mount, navigation):** read `?userView` once on mount,
 *     fetch the view via `GET /api/shared-views/:viewId`, hydrate it into
 *     the data-table via `onApplySharedView`. If the lookup 404s (view
 *     doesn't exist OR the session lacks read on the bound table) we leave
 *     the URL untouched — the page render layer has already 404'd the page
 *     itself when the gate fails on a known table, and a stale id on a real
 *     table just silently ignores the param.
 *
 *  2. **state → URL (user navigation):** subscribe to `sovrium:view-applied`
 *     and `sovrium:view-deleted` events the orchestrator already dispatches.
 *     Applying a view writes `?userView=<id>` via `history.replaceState`;
 *     deleting the currently-loaded view (or clearing it) strips the param.
 *     `replaceState` (not `pushState`) so the browser back button isn't
 *     polluted with every view switch.
 *
 * Co-located with `useSavedViewsOrchestration` because the URL surface is
 * the orchestrator's natural seam — the deferral marker in that file points
 * here. Splitting it out keeps the orchestrator DOM-free (the comment
 * thread at the top of `use-saved-views-orchestration.ts` calls this out
 * explicitly).
 *
 * SSR-safety: every `window`/`history` access is guarded so the hook can be
 * imported into modules that run server-side under test. The real DOM
 * effects only fire after `useEffect` runs on the client.
 */

/** Shape returned by `GET /api/shared-views/:viewId`. Mirrors `toResponseRow`. */
interface SharedViewResponse {
  readonly id: string
  readonly name: string
  readonly tableName: string
  readonly filters?: ReadonlyArray<{
    readonly field: string
    readonly operator: string
    readonly value: unknown
  }>
  readonly sorts?: ReadonlyArray<{
    readonly field: string
    readonly direction: 'asc' | 'desc'
  }>
  readonly groupBy?: string | null
}

export interface UrlSyncedActiveViewParams {
  /** Logical table name the data-table is bound to — used to scope the URL sync. */
  readonly tableName: string
  /**
   * Apply a fetched shared view to the data-table UI state. Mirrors
   * `useDataTableUiState.applySavedView` but with the source forced to
   * `'personal'` (shared views are always personal under-the-hood; the
   * developer-vs-personal discriminator is for the *menu* projection only).
   */
  readonly onApplySharedView: (input: {
    readonly id: string
    readonly filters: readonly FilterRow[]
    readonly sorts: readonly SortRow[]
    readonly groupBy: string | null
  }) => void
}

/**
 * Read `?userView` from the current URL. Returns `undefined` on the server
 * and when the param is absent or empty.
 */
function readUserViewParam(): string | undefined {
  if (typeof window === 'undefined') return undefined
  const param = new URLSearchParams(window.location.search).get('userView')
  return param === null || param === '' ? undefined : param
}

/**
 * Write or strip `?userView=<id>` from the current URL via `replaceState`,
 * leaving the rest of the query string intact.
 */
/* eslint-disable drizzle/enforce-delete-with-where -- the `.delete()` call is on `URLSearchParams`, not on a Drizzle query builder; the rule false-positives on the method name */
function writeUserViewParam(viewId: string | undefined): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (viewId === undefined) {
    url.searchParams.delete('userView')
  } else {
    url.searchParams.set('userView', viewId)
  }
  window.history.replaceState(window.history.state, '', url.toString())
}
/* eslint-enable drizzle/enforce-delete-with-where */

/**
 * Translate the saved-view API filter shape into the FilterRow shape the
 * runtime UI consumes. Mirrors `toFilterRows` in
 * `use-saved-views-orchestration.ts` so both ingestion paths converge on the
 * same internal vocabulary.
 */
function toFilterRowsFromShared(
  filters: SharedViewResponse['filters'],
  prefix: string
): readonly FilterRow[] {
  return (filters ?? []).map((f, i) => ({
    id: `${prefix}-${i}`,
    field: f.field,
    operator: f.operator,
    value: stringifyFilterValue(f.value),
  }))
}

/**
 * Coerce a stored filter value (which the API JSONB blob preserves as
 * `unknown`) into the comma-separated string FilterRow expects. Arrays are
 * the common case for multi-value operators (`is-any-of`, `is-none-of`);
 * single primitives stringify trivially.
 */
function stringifyFilterValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map((v) => String(v ?? '')).join(',')
  if (value === null || value === undefined) return ''
  return String(value)
}

/** Translate shared-view sorts into SortRow shape. */
function toSortRowsFromShared(
  sorts: SharedViewResponse['sorts'],
  prefix: string
): readonly SortRow[] {
  return (sorts ?? []).map((s, i) => ({
    id: `${prefix}-${i}`,
    field: s.field,
    direction: s.direction,
  }))
}

/**
 * Hook entry-point. Wire URL-to-state on mount + state-to-URL via event-bus
 * subscriptions. The mount fetch is fired-and-forgotten — failures fall back
 * to the default-view auto-load path the orchestrator already handles.
 */
export function useUrlSyncedActiveView({
  tableName,
  onApplySharedView,
}: UrlSyncedActiveViewParams) {
  // Once the mount fetch has fired we don't want it to re-fire on prop
  // changes (e.g. when the orchestrator re-creates `onApplySharedView` via
  // useCallback's dep array). A ref guards against that.
  const initialFetchDoneRef = useRef(false)

  // Effect 1 — mount: read `?userView` and hydrate the table-bound view.
  useEffect(() => {
    if (initialFetchDoneRef.current) return
    const viewId = readUserViewParam()
    if (viewId === undefined) {
      // eslint-disable-next-line functional/immutable-data -- React ref mutation is the canonical pattern for one-shot guards
      initialFetchDoneRef.current = true
      return
    }
    // eslint-disable-next-line functional/immutable-data -- See above.
    initialFetchDoneRef.current = true
    void fetch(`/api/shared-views/${encodeURIComponent(viewId)}`, {
      credentials: 'same-origin',
    })
      .then((res) => (res.ok ? (res.json() as Promise<SharedViewResponse>) : undefined))
      .then((view) => {
        if (view === undefined) return
        // If the URL's view doesn't match the table this island is bound to,
        // do nothing — the page renderer's anti-enumeration layer is what
        // 404s a cross-table reference. Leaving the data-table alone here
        // keeps the island idempotent if multiple data-tables share a page.
        if (view.tableName !== tableName) return
        onApplySharedView({
          id: view.id,
          filters: toFilterRowsFromShared(view.filters, 'url-f'),
          sorts: toSortRowsFromShared(view.sorts, 'url-s'),
          // eslint-disable-next-line unicorn/no-null -- `groupBy: null` is the explicit "no group" signal in `ApplySavedView` (mirrors `useDataTableUiState`); converting to undefined would change the discriminator
          groupBy: view.groupBy ?? null,
        })
      })
      .catch(() => {
        // Network errors are not user-actionable here; the URL stays put
        // and the table renders with whatever default state is already
        // active.
      })
  }, [tableName, onApplySharedView])

  // Effect 2 — subscriptions: keep the URL in sync as the user navigates
  // between views (`sovrium:view-applied`) or deletes the loaded view
  // (`sovrium:view-deleted` for the matching id).
  useEffect(() => {
    const unsubscribeApplied = subscribeIslandEvent('sovrium:view-applied', (detail) => {
      if (detail.table !== tableName) return
      // `viewId: null` signals the cleared/default state (per ViewAppliedDetail);
      // strip the URL param to match.
      writeUserViewParam(detail.viewId ?? undefined)
    })
    const unsubscribeDeleted = subscribeIslandEvent('sovrium:view-deleted', (detail) => {
      if (detail.table !== tableName) return
      // Only strip the param if the deleted view is the one currently in
      // the URL — sibling deletions shouldn't clear an unrelated share-link.
      const current = readUserViewParam()
      if (current === detail.viewId) writeUserViewParam(undefined)
    })
    return () => {
      unsubscribeApplied()
      unsubscribeDeleted()
    }
  }, [tableName])
}
