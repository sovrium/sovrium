/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import { UI_TO_API_OPERATOR } from '../data-table/island/operator-vocabulary'
import type { RowDensity } from './use-table-preferences'
import type { DataTableViewType } from '@/domain/models/app/pages/components/component-types/data/data-table/schema'
import type { DataFilter } from '@/domain/models/app/pages/components/data-source'

/**
 * Hook for reading the caller's saved views for a given table.
 *
 * Used by the data-table island to resolve the active default view
 * — the table preferences row points at a view by
 * `defaultViewId`, this hook fetches the actual filter/sort payload to apply.
 *
 * Backed by `GET /api/tables/:table/user-views`.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Filter payload stored inside a saved view config (API-vocabulary operators). */
interface SavedViewFilter {
  readonly field: string
  readonly operator: string
  readonly value: unknown
}

/** Sort payload stored inside a saved view config. */
interface SavedViewSort {
  readonly field: string
  readonly direction: 'asc' | 'desc'
}

export interface SavedView {
  readonly id: string
  readonly name: string
  readonly tableName: string
  readonly isDefault: boolean
  readonly filters?: readonly SavedViewFilter[]
  readonly sorts?: readonly SavedViewSort[]
  readonly fields?: readonly string[]
  /**
   * Presentation state. A saved view restores
   * what the user actually SAW, not only which records they saw.
   *
   * All three are independently optional and absence is MEANINGFUL: it says
   * "this view expresses no opinion", and the per-(user, table)
   * `user-preferences` value is the fallback. Views persisted before these keys
   * existed therefore keep working, and applying one must not clobber the
   * user's table-wide density.
   */
  readonly viewType?: DataTableViewType
  readonly rowDensity?: RowDensity
  readonly columnWidths?: Readonly<Record<string, number>>
  readonly createdAt?: string
  readonly updatedAt?: string
}

const EMPTY_VIEWS: readonly SavedView[] = []

// ---------------------------------------------------------------------------
// Operator translation
// ---------------------------------------------------------------------------

/**
 * Saved views store filter operators in the **API vocabulary** (`equals`,
 * `notEquals`, `greaterThan` …) — what callers pass to the records API.
 *
 * The `dataSource.filter` channel used by `useDataTableQuery` expects the
 * **domain vocabulary** (`eq`, `neq`, `gt`, …) from `FilterOperatorSchema`,
 * which the query hook then re-translates back to the API vocabulary on the
 * way out. This map bridges the saved-view side of that pipeline so an
 * `assignee equals "Alice"` predicate stored in a view actually narrows the
 * server-side query.
 *
 * Cross-reference (Cycle 5: save-views) — the runtime filter-builder
 * (`src/presentation/islands/data-table/island/filter-operators.ts`) uses a
 * THIRD vocabulary (spaced English, e.g. `'greater than'`, `'starts with'`)
 * for human-readable `<option>` labels. When serialising a `FilterRow[]` from
 * the panel into a saved view, the call site MUST translate UI → API first
 * (e.g. `'greater than'` → `'greaterThan'`) before this map can do its job;
 * otherwise the fallback below passes the spaced-English string verbatim and
 * the records API silently drops the predicate. See the VOCABULARY CONTRACT
 * comment in `filter-operators.ts` for the full three-vocabulary picture.
 *
 * Phase 7 Cycle 2 — multi-value bridge closed: `is-any-of` / `is-none-of`
 * filtering happens entirely client-side in `evaluatePredicate`, which now
 * recognizes all three vocabulary forms. The single-value path (this map)
 * still bridges UI → API for save persistence; the multi-value path no
 * longer needs an API → domain entry below because the records endpoint
 * doesn't apply these operators server-side — they only matter to the
 * runtime row-narrowing in `applyClientFilters`.
 *
 * Phase 7 Cycle 2 audit — single-value bridge generalised: `evaluatePredicate`
 * now also recognises every API-vocabulary single-value operator (e.g.
 * `'startsWith'`, `'doesNotContain'`, `'isBefore'`) via its internal
 * `API_TO_UI_OPERATOR` map. Previously, loading a saved view authored with
 * those operators silently no-op'd the predicate during client-side row
 * narrowing because `toFilterRows` in `use-saved-views-orchestration.ts`
 * passes the persisted API-vocabulary string straight into `FilterRow.operator`.
 */
const API_TO_DOMAIN_OPERATOR: Record<string, DataFilter['operator']> = {
  equals: 'eq',
  notEquals: 'neq',
  greaterThan: 'gt',
  greaterThanOrEqual: 'gte',
  lessThan: 'lt',
  lessThanOrEqual: 'lte',
  contains: 'contains',
}

/**
 * Translate a saved view's stored filters into the `DataFilter[]` shape the
 * data-table query hook accepts. Unknown operators are passed through verbatim
 * so the records API still has a chance to reject them with a meaningful
 * error rather than silently dropping the predicate.
 */
export function savedViewFiltersToDataFilters(
  filters: readonly SavedViewFilter[] | undefined
): readonly DataFilter[] | undefined {
  if (!filters || filters.length === 0) return undefined
  return filters.map((filter) => ({
    field: filter.field,
    operator:
      API_TO_DOMAIN_OPERATOR[filter.operator] ?? (filter.operator as DataFilter['operator']),
    value: filter.value as DataFilter['value'],
  }))
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseSavedViewsResult {
  readonly views: readonly SavedView[]
  readonly isLoading: boolean
}

// ---------------------------------------------------------------------------
// UI → API operator translator (Cycle 5)
// ---------------------------------------------------------------------------

/**
 * Translate a UI-vocabulary operator (e.g. `'greater than'`) into the
 * API-vocabulary form persisted in a saved view's `config.filters[]`. Pass-
 * through for operators with no rename (e.g. `'contains'`, `'equals'`).
 *
 * The `UI_TO_API_OPERATOR` table is the canonical forward map in
 * `operator-vocabulary.ts`; its reverse (used when a saved view is loaded back
 * into the filter builder) is derived from the same table, so the two
 * directions can never drift.
 */
export function translateUiToApiOperator(uiOperator: string): string {
  return UI_TO_API_OPERATOR[uiOperator] ?? uiOperator
}

// ---------------------------------------------------------------------------
// Mutation hooks (Cycle 5)
// ---------------------------------------------------------------------------

/**
 * The UI-shaped view config a caller (CrudForm / FilterBuilder / SortOverlay)
 * passes to `useCreateSavedView` / `useUpdateSavedView`. Filters carry
 * UI-vocabulary operators (e.g. `'greater than'`); the mutation hooks
 * translate to API vocabulary before persisting.
 */
export interface SavedViewConfigPayload {
  readonly filters?: ReadonlyArray<{
    readonly field: string
    readonly operator: string
    readonly value: unknown
  }>
  readonly sorts?: ReadonlyArray<{
    readonly field: string
    readonly direction: 'asc' | 'desc'
  }>
  readonly fields?: ReadonlyArray<string>
  readonly groupBy?: string | null
  /**
   * Presentation state persisted alongside the record predicate — see
   * {@link SavedView} for why each is independently optional.
   */
  readonly viewType?: DataTableViewType
  readonly rowDensity?: RowDensity
  readonly columnWidths?: Readonly<Record<string, number>>
  /** Schema-view ID this personal view was forked from (developer view). */
  readonly baseViewId?: string | number
}

interface CreateSavedViewInput {
  readonly name: string
  readonly config?: SavedViewConfigPayload
}

interface UpdateSavedViewInput {
  readonly viewId: string
  readonly name?: string
  readonly config?: SavedViewConfigPayload
}

/**
 * Serialise the UI-shaped config into the wire format the
 * `POST /api/tables/:tableId/user-views` route expects. Filter operators are
 * translated to API vocabulary before transmission (see the VOCABULARY CONTRACT
 * comment above), so a `'greater than'` predicate authored in the filter panel
 * lands as `'greaterThan'` in the JSONB column and round-trips correctly
 * through `API_TO_DOMAIN_OPERATOR` on read.
 */
function configToWirePayload(config: SavedViewConfigPayload): Record<string, unknown> {
  const translatedFilters = config.filters?.map((f) => ({
    field: f.field,
    operator: translateUiToApiOperator(f.operator),
    value: f.value,
  }))
  return {
    ...(translatedFilters !== undefined ? { filters: translatedFilters } : {}),
    ...(config.sorts !== undefined ? { sorts: config.sorts } : {}),
    ...(config.fields !== undefined ? { fields: config.fields } : {}),
    ...(config.groupBy !== undefined ? { groupBy: config.groupBy } : {}),
    ...(config.viewType !== undefined ? { viewType: config.viewType } : {}),
    ...(config.rowDensity !== undefined ? { rowDensity: config.rowDensity } : {}),
    ...(config.columnWidths !== undefined ? { columnWidths: config.columnWidths } : {}),
    ...(config.baseViewId !== undefined ? { baseViewId: config.baseViewId } : {}),
  }
}

/**
 * Create a personal saved view for the bound table. Resolves to the created
 * `SavedView` row (including its server-assigned `id`). On HTTP 409 (duplicate
 * name) the promise rejects with an `Error` whose message includes `'CONFLICT'`
 * — callers can branch on that to surface an inline error in the dialog
 * without crashing the island.
 */
/** Throw an HTTP-error with the conflict marker when status === 409. */
const httpErrorFor = (response: Response, what: string): Error =>
  response.status === 409
    ? new Error(`CONFLICT: ${what} name already exists`)
    : new Error(`Failed to ${what} view (HTTP ${response.status})`)

export function useCreateSavedView(tableName: string) {
  const queryClient = useQueryClient()
  return useMutation<SavedView, Error, CreateSavedViewInput>({
    mutationFn: async ({ name, config }) => {
      const body = { name, ...(config ? configToWirePayload(config) : {}) }
      const response = await fetch(`/api/tables/${tableName}/user-views`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        // eslint-disable-next-line functional/no-throw-statements -- TanStack Query's mutation contract uses thrown errors as the rejection channel; rewriting as `Effect.fail` requires a layer change beyond this hook's scope
        throw httpErrorFor(response, 'save')
      }
      return (await response.json()) as SavedView
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['user-saved-views', tableName] })
    },
  })
}

/**
 * Update an existing personal saved view. The `viewId` must belong to the
 * caller; the route returns 404 otherwise (handled like other fetch errors).
 */
export function useUpdateSavedView(tableName: string) {
  const queryClient = useQueryClient()
  return useMutation<SavedView, Error, UpdateSavedViewInput>({
    mutationFn: async ({ viewId, name, config }) => {
      const body = {
        ...(name !== undefined ? { name } : {}),
        ...(config ? configToWirePayload(config) : {}),
      }
      const response = await fetch(`/api/tables/${tableName}/user-views/${viewId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        // eslint-disable-next-line functional/no-throw-statements -- TanStack Query's mutation contract uses thrown errors as the rejection channel
        throw httpErrorFor(response, 'update')
      }
      return (await response.json()) as SavedView
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['user-saved-views', tableName] })
    },
  })
}

/**
 * Delete a personal saved view. The mutation accepts a bare `viewId` for the
 * common UX where the delete button is rendered alongside a single view row.
 */
export function useDeleteSavedView(tableName: string) {
  const queryClient = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: async (viewId) => {
      const response = await fetch(`/api/tables/${tableName}/user-views/${viewId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!response.ok) {
        // eslint-disable-next-line functional/no-throw-statements -- TanStack Query's mutation contract uses thrown errors as the rejection channel
        throw new Error(`Failed to delete view (HTTP ${response.status})`)
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['user-saved-views', tableName] })
    },
  })
}

/**
 * Convenience hook bundling the three view mutations under stable callback
 * references. Lets the toolbar / dialog / menu plumbing receive a single
 * `actions` prop instead of three.
 */
export function useSavedViewActions(tableName: string) {
  const create = useCreateSavedView(tableName)
  const update = useUpdateSavedView(tableName)
  const remove = useDeleteSavedView(tableName)

  const createView = useCallback(
    (input: CreateSavedViewInput) => create.mutateAsync(input),
    [create]
  )
  const updateView = useCallback(
    (input: UpdateSavedViewInput) => update.mutateAsync(input),
    [update]
  )
  const deleteView = useCallback((viewId: string) => remove.mutateAsync(viewId), [remove])

  return { createView, updateView, deleteView }
}

export function useSavedViews(tableName: string): UseSavedViewsResult {
  const { data } = useSuspenseQuery<readonly SavedView[]>({
    queryKey: ['user-saved-views', tableName],
    queryFn: async () => {
      // A system-source data-table has no DB table — `tableName` is empty. Skip
      // the network read so no `/api/tables//user-views` request is issued
      // (saved/user views are a DB-table-only feature).
      if (!tableName) return EMPTY_VIEWS
      const response = await fetch(`/api/tables/${tableName}/user-views`, {
        credentials: 'include',
      })
      if (!response.ok) return EMPTY_VIEWS
      return (await response.json()) as readonly SavedView[]
    },
    // Use initialData so the island doesn't suspend just to learn the user
    // has no saved views — most data-tables won't have any, and the row-click
    // interactivity should not block on this fetch ([internal ref]
    // and similar specs fire `tbody tr` clicks before the views endpoint
    // would otherwise resolve).
    initialData: EMPTY_VIEWS,
    // Even with initialData, force a background refetch so the views list
    // stays in sync with server changes (default-view auto-load — the spec
    // mutates the views via API and expects the next data-table mount to
    // pick up the new view).
    refetchOnMount: 'always',
    staleTime: 0,
  })

  return { views: data, isLoading: false }
}
