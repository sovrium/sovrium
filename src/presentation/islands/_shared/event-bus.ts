/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export type SovriumEventName =
  | 'sovrium:crud-success'
  | 'sovrium:open-drawer'
  | 'sovrium:refetch'
  | 'sovrium:view-saved'
  | 'sovrium:view-applied'
  | 'sovrium:view-deleted'

export interface CrudSuccessDetail {
  readonly table: string
  readonly operation: 'create' | 'update' | 'delete' | 'automation'
  readonly recordId?: string
}

export interface OpenDrawerDetail {
  readonly id: string
  readonly record: Record<string, unknown>
}

export interface RefetchDetail {
  readonly id: string
}

export interface ViewSavedDetail {
  readonly table: string
  readonly viewId: string
  readonly name: string
  readonly operation: 'create' | 'update'
}

export interface ViewAppliedDetail {
  readonly table: string
  readonly viewId: string | null
  readonly source: 'personal' | 'developer'
}

export interface ViewDeletedDetail {
  readonly table: string
  readonly viewId: string
}

export interface SovriumEventPayloads {
  readonly 'sovrium:crud-success': CrudSuccessDetail
  readonly 'sovrium:open-drawer': OpenDrawerDetail
  readonly 'sovrium:refetch': RefetchDetail
  readonly 'sovrium:view-applied': ViewAppliedDetail
  readonly 'sovrium:view-deleted': ViewDeletedDetail
  readonly 'sovrium:view-saved': ViewSavedDetail
}

export function dispatch<T extends SovriumEventName>(
  name: T,
  detail: SovriumEventPayloads[T]
): void {
  if (typeof document === 'undefined') return
  document.dispatchEvent(new CustomEvent(name, { detail }))
}

export function subscribe<T extends SovriumEventName>(
  name: T,
  handler: (detail: SovriumEventPayloads[T]) => void
): () => void {
  if (typeof document === 'undefined') return () => undefined
  const listener = (event: Event): void => {
    const { detail } = event as CustomEvent<SovriumEventPayloads[T]>
    handler(detail)
  }
  document.addEventListener(name, listener)
  return () => document.removeEventListener(name, listener)
}
