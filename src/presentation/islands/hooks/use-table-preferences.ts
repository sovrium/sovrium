/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import type { RowHeight } from '@/domain/models/app/pages/components/data-table'



export type RowDensity = 'compact' | 'normal' | 'spacious'

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

const EMPTY_PREFS: UserTablePreferences = {}

const queryKeyFor = (tableName: string) => ['user-table-preferences', tableName] as const


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
  }
}

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
  }
}


export interface UseTablePreferencesResult {
  readonly preferences: UserTablePreferences
  readonly isLoading: boolean
  readonly updatePreferences: (patch: Partial<UserTablePreferences>) => void
  readonly resetPreferences: () => void
}

function usePreferencesQuery(tableName: string) {
  return useSuspenseQuery<UserTablePreferences>({
    queryKey: queryKeyFor(tableName),
    queryFn: async () => {
      const response = await fetch(`/api/tables/${tableName}/user-preferences`, {
        credentials: 'include',
      })
      if (!response.ok) return EMPTY_PREFS
      const body = (await response.json()) as UserTablePreferences
      writeCached(tableName, body)
      return body
    },
    initialData: () => {
      const cached = readCached(tableName)
      return Object.keys(cached).length > 0 ? cached : undefined
    },
    refetchOnMount: 'always',
    staleTime: 0,
  })
}

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

function usePreferencesResetMutation(tableName: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/tables/${tableName}/user-preferences`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!response.ok) {
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
