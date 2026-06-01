/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import { UI_TO_API_OPERATOR } from '../data-table/island/operator-vocabulary'
import type { DataFilter } from '@/domain/models/app/pages/components/data-source'



interface SavedViewFilter {
  readonly field: string
  readonly operator: string
  readonly value: unknown
}

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
  readonly createdAt?: string
  readonly updatedAt?: string
}

const EMPTY_VIEWS: readonly SavedView[] = []


const API_TO_DOMAIN_OPERATOR: Record<string, DataFilter['operator']> = {
  equals: 'eq',
  notEquals: 'neq',
  greaterThan: 'gt',
  greaterThanOrEqual: 'gte',
  lessThan: 'lt',
  lessThanOrEqual: 'lte',
  contains: 'contains',
}

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


export interface UseSavedViewsResult {
  readonly views: readonly SavedView[]
  readonly isLoading: boolean
}


export function translateUiToApiOperator(uiOperator: string): string {
  return UI_TO_API_OPERATOR[uiOperator] ?? uiOperator
}


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
    ...(config.baseViewId !== undefined ? { baseViewId: config.baseViewId } : {}),
  }
}

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
        throw httpErrorFor(response, 'save')
      }
      return (await response.json()) as SavedView
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['user-saved-views', tableName] })
    },
  })
}

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
        throw httpErrorFor(response, 'update')
      }
      return (await response.json()) as SavedView
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['user-saved-views', tableName] })
    },
  })
}

export function useDeleteSavedView(tableName: string) {
  const queryClient = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: async (viewId) => {
      const response = await fetch(`/api/tables/${tableName}/user-views/${viewId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!response.ok) {
        throw new Error(`Failed to delete view (HTTP ${response.status})`)
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['user-saved-views', tableName] })
    },
  })
}

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
      const response = await fetch(`/api/tables/${tableName}/user-views`, {
        credentials: 'include',
      })
      if (!response.ok) return EMPTY_VIEWS
      return (await response.json()) as readonly SavedView[]
    },
    initialData: EMPTY_VIEWS,
    refetchOnMount: 'always',
    staleTime: 0,
  })

  return { views: data, isLoading: false }
}
