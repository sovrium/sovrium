/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useRef } from 'react'
import { subscribe as subscribeIslandEvent } from '../../_shared/event-bus'
import type { FilterRow, SortRow } from './use-ui-state'


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
  readonly tableName: string
  readonly onApplySharedView: (input: {
    readonly id: string
    readonly filters: readonly FilterRow[]
    readonly sorts: readonly SortRow[]
    readonly groupBy: string | null
  }) => void
}

function readUserViewParam(): string | undefined {
  if (typeof window === 'undefined') return undefined
  const param = new URLSearchParams(window.location.search).get('userView')
  return param === null || param === '' ? undefined : param
}

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

function stringifyFilterValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map((v) => String(v ?? '')).join(',')
  if (value === null || value === undefined) return ''
  return String(value)
}

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

export function useUrlSyncedActiveView({
  tableName,
  onApplySharedView,
}: UrlSyncedActiveViewParams) {
  const initialFetchDoneRef = useRef(false)

  useEffect(() => {
    if (initialFetchDoneRef.current) return
    const viewId = readUserViewParam()
    if (viewId === undefined) {
      initialFetchDoneRef.current = true
      return
    }
    initialFetchDoneRef.current = true
    void fetch(`/api/shared-views/${encodeURIComponent(viewId)}`, {
      credentials: 'same-origin',
    })
      .then((res) => (res.ok ? (res.json() as Promise<SharedViewResponse>) : undefined))
      .then((view) => {
        if (view === undefined) return
        if (view.tableName !== tableName) return
        onApplySharedView({
          id: view.id,
          filters: toFilterRowsFromShared(view.filters, 'url-f'),
          sorts: toSortRowsFromShared(view.sorts, 'url-s'),
          groupBy: view.groupBy ?? null,
        })
      })
      .catch(() => {
      })
  }, [tableName, onApplySharedView])

  useEffect(() => {
    const unsubscribeApplied = subscribeIslandEvent('sovrium:view-applied', (detail) => {
      if (detail.table !== tableName) return
      writeUserViewParam(detail.viewId ?? undefined)
    })
    const unsubscribeDeleted = subscribeIslandEvent('sovrium:view-deleted', (detail) => {
      if (detail.table !== tableName) return
      const current = readUserViewParam()
      if (current === detail.viewId) writeUserViewParam(undefined)
    })
    return () => {
      unsubscribeApplied()
      unsubscribeDeleted()
    }
  }, [tableName])
}
