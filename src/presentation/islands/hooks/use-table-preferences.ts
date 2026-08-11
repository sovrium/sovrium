/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import type { RowHeight } from '@/domain/models/app/pages/components/component-types/data/data-table/schema'

/**
 * Hook for reading + persisting per-user, per-table runtime preferences
 * (PG-03 / [internal ref]).
 *
 * Backed by `GET /api/tables/:table/user-preferences` (read) and
 * `PATCH /api/tables/:table/user-preferences` (upsert merge). The server-side
 * route accepts both PATCH and PUT; this hook uses PATCH so the body's
 * undefined fields preserve the existing row.
 *
 * Persistence is server-side (cross-device sync — [internal ref]). The
 * hook does not hit localStorage; cross-device synchronization relies on the
 * server being the source of truth and `refetchOnMount` re-reading on
 * navigation.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * User-facing density labels exposed in the density menu.
 *
 * The schema-level `RowHeight` is `short | medium | tall` — these are the
 * spec-facing equivalents (`compact | normal | spacious`). The mapping below
 * is the single source of truth, used both when serializing to the prefs row
 * and when rendering the density menu items.
 */
export type RowDensity = 'compact' | 'normal' | 'spacious'

/** Map between the spec-facing density label and the schema-level row height. */
const DENSITY_TO_HEIGHT: Record<RowDensity, RowHeight> = {
  compact: 'short',
  normal: 'medium',
  spacious: 'tall',
}

const HEIGHT_TO_DENSITY: Record<RowHeight, RowDensity> = {
  short: 'compact',
  medium: 'normal',
  tall: 'spacious',
}

export const densityToHeight = (density: RowDensity): RowHeight => DENSITY_TO_HEIGHT[density]
export const heightToDensity = (height: RowHeight): RowDensity => HEIGHT_TO_DENSITY[height]

export interface UserTablePreferences {
  readonly columnWidths?: Record<string, number>
  readonly columnOrder?: readonly string[]
  readonly rowDensity?: RowDensity
  readonly defaultViewId?: string
  readonly frozenColumns?: number
}

/** Empty-preferences sentinel — used when the row does not yet exist. */
const EMPTY_PREFS: UserTablePreferences = {}

const queryKeyFor = (tableName: string) => ['user-table-preferences', tableName] as const

// ---------------------------------------------------------------------------
// Synchronous cache (localStorage)
// ---------------------------------------------------------------------------

/**
 * localStorage key for the persisted preferences cache for `tableName`.
 *
 * The cache is purely a read-through optimization so a freshly-reloaded page
 * can render the right row density on the FIRST paint — before the async
 * server fetch resolves. The server remains the source of truth: every
 * successful read/write echoes back through this cache, and a cache hit is
 * always re-validated against the server.
 */
const cacheKeyFor = (tableName: string) => `sovrium:table-prefs:${tableName}`

const readCached = (tableName: string): UserTablePreferences => {
  if (typeof localStorage === 'undefined') return EMPTY_PREFS
  try {
    const raw = localStorage.getItem(cacheKeyFor(tableName))
    if (!raw) return EMPTY_PREFS
    const parsed = JSON.parse(raw) as UserTablePreferences
    return parsed
  } catch {
    return EMPTY_PREFS
  }
}

const writeCached = (tableName: string, prefs: UserTablePreferences): void => {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(cacheKeyFor(tableName), JSON.stringify(prefs))
  } catch {
    // localStorage may throw on Safari private mode / quota exceeded; swallow
    // because the network round-trip remains the authoritative path.
  }
}

/**
 * Synchronously merge a column-widths patch into the localStorage cache for
 * `tableName`. Used by the data-table island's resize handler to make a
 * fresh `page.reload()` immediately see the new width — before the
 * debounced server PATCH has fired.
 *
 * Falls through silently if localStorage is unavailable; the server PATCH
 * eventually round-trips and the next focus refetch reconciles.
 */
export function writeColumnWidthsToCache(
  tableName: string,
  columnWidths: Record<string, number>
): void {
  const current = readCached(tableName)
  writeCached(tableName, { ...current, columnWidths })
}

const clearCached = (tableName: string): void => {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(cacheKeyFor(tableName))
  } catch {
    // intentionally swallow
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseTablePreferencesResult {
  /** Latest preferences (empty object until the first GET resolves). */
  readonly preferences: UserTablePreferences
  /** True while the initial GET is in flight. */
  readonly isLoading: boolean
  /**
   * Merge a partial preferences patch onto the server-side row.
   * Undefined fields preserve the existing value.
   */
  readonly updatePreferences: (patch: Partial<UserTablePreferences>) => void
  /** Reset every preference field on the server (clears the row to all-null). */
  readonly resetPreferences: () => void
}

/**
 * GET query — server-backed read with cross-device sync semantics.
 *
 * Uses `useSuspenseQuery` so the data-table island's `<Suspense>` boundary
 * (set up by React.lazy in `island-registry.ts`) suspends until the very
 * first fetch resolves. This is the only way to guarantee that the first
 * paint after `page.reload()` already reflects the persisted density / column
 * widths — without SSR injecting the prefs into the markup directly.
 *
 * The localStorage cache acts as `initialData` so the suspension is skipped
 * entirely on the second-and-later mounts in the same browsing session; only
 * cross-device / cold-cache cases actually wait on the network.
 */
function usePreferencesQuery(tableName: string) {
  return useSuspenseQuery<UserTablePreferences>({
    queryKey: queryKeyFor(tableName),
    queryFn: async () => {
      // A system-source data-table has no DB table — `tableName` is empty. Skip
      // the network read entirely so no `/api/tables//user-preferences` request
      // is ever issued (user-preferences are a DB-table-only feature).
      if (!tableName) return EMPTY_PREFS
      const response = await fetch(`/api/tables/${tableName}/user-preferences`, {
        credentials: 'include',
      })
      if (!response.ok) return EMPTY_PREFS
      const body = (await response.json()) as UserTablePreferences
      writeCached(tableName, body)
      return body
    },
    // Read the last-known prefs from localStorage so the very first render
    // after `page.reload()` already has the persisted density / column
    // widths available — bypasses the Suspense fallback on warm reloads.
    initialData: () => {
      const cached = readCached(tableName)
      // Only use cached data if it has actual content; otherwise let
      // Suspense wait for the fresh server response (cold-cache / cross-device).
      return Object.keys(cached).length > 0 ? cached : undefined
    },
    // Even when `initialData` is provided, force a background refetch on
    // every mount so cross-device updates land (server is the source of truth
    // — [internal ref]). With `staleTime: 0` and `'always'`, the cache
    // is reconciled with the server every navigation.
    refetchOnMount: 'always',
    staleTime: 0,
  })
}

/** PATCH mutation — merge-upsert preferences. Echoes back the canonical row.
 *
 * Uses an OPTIMISTIC UPDATE so the data-table re-renders with the new
 * preferences *immediately* on the next React commit, without waiting for the
 * server round-trip. The mutation still fires (server is the source of
 * truth) and `onSuccess` overwrites with the canonical response if the
 * shapes drift.
 */
function usePreferencesUpdateMutation(tableName: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (patch: Partial<UserTablePreferences>) => {
      const response = await fetch(`/api/tables/${tableName}/user-preferences`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!response.ok) {
        // eslint-disable-next-line functional/no-throw-statements -- TanStack Query mutations expect thrown errors
        throw new Error('Failed to save preferences')
      }
      return (await response.json()) as UserTablePreferences
    },
    onMutate: async (patch) => {
      const queryKey = queryKeyFor(tableName)
      const previous = queryClient.getQueryData<UserTablePreferences>(queryKey) ?? EMPTY_PREFS
      const optimistic: UserTablePreferences = { ...previous, ...patch }
      writeCached(tableName, optimistic)
      queryClient.setQueryData(queryKey, optimistic)
      return { previous }
    },
    onError: (_err, _patch, context) => {
      if (context?.previous) {
        writeCached(tableName, context.previous)
        queryClient.setQueryData(queryKeyFor(tableName), context.previous)
      }
    },
    onSuccess: (next) => {
      writeCached(tableName, next)
      queryClient.setQueryData(queryKeyFor(tableName), next)
    },
  })
}

/** DELETE mutation — clears the preferences row. */
function usePreferencesResetMutation(tableName: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/tables/${tableName}/user-preferences`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!response.ok) {
        // eslint-disable-next-line functional/no-throw-statements -- TanStack Query mutations expect thrown errors
        throw new Error('Failed to reset preferences')
      }
      return EMPTY_PREFS
    },
    onSuccess: () => {
      clearCached(tableName)
      queryClient.setQueryData(queryKeyFor(tableName), EMPTY_PREFS)
    },
  })
}

export function useTablePreferences(tableName: string): UseTablePreferencesResult {
  const queryClient = useQueryClient()
  const { data, isLoading } = usePreferencesQuery(tableName)
  const updateMutation = usePreferencesUpdateMutation(tableName)
  const resetMutation = usePreferencesResetMutation(tableName)

  const updatePreferences = useCallback(
    (patch: Partial<UserTablePreferences>) => updateMutation.mutate(patch),
    [updateMutation]
  )

  const resetPreferences = useCallback(() => {
    // Optimistic UI clear so the data-table re-derives state from the schema
    // defaults without waiting for the round-trip; the DELETE response (also
    // empty) overwrites identically on success.
    clearCached(tableName)
    queryClient.setQueryData(queryKeyFor(tableName), EMPTY_PREFS)
    resetMutation.mutate()
  }, [resetMutation, queryClient, tableName])

  return {
    preferences: data ?? EMPTY_PREFS,
    isLoading,
    updatePreferences,
    resetPreferences,
  }
}
