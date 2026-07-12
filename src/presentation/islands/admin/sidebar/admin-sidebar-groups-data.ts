/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export interface SidebarGroupItem {
  readonly name: string
}

export type GroupLoadPhase = 'idle' | 'loading' | 'loaded' | 'error'

export interface GroupLoadState {
  readonly phase: GroupLoadPhase
  readonly items: ReadonlyArray<SidebarGroupItem>
}

export const IDLE_GROUP_STATE: GroupLoadState = { phase: 'idle', items: [] }

function toItem(raw: unknown): SidebarGroupItem | undefined {
  if (raw === null || typeof raw !== 'object') return undefined
  const { name } = raw as { readonly name?: unknown }
  return typeof name === 'string' && name.length > 0 ? { name } : undefined
}

async function fetchItems(url: string, arrayKey: 'by_table' | 'items'): Promise<GroupLoadState> {
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return { phase: 'error', items: [] }
    const body = (await res.json()) as Record<string, unknown>
    const rows = Array.isArray(body[arrayKey]) ? (body[arrayKey] as ReadonlyArray<unknown>) : []
    const items = rows.flatMap((row) => {
      const item = toItem(row)
      return item ? [item] : []
    })
    return { phase: 'loaded', items }
  } catch {
    return { phase: 'error', items: [] }
  }
}

export async function fetchGroupItems(key: string): Promise<GroupLoadState> {
  if (key === 'tables') return fetchItems('/api/admin/tables/overview', 'by_table')
  if (key === 'forms') return fetchItems('/api/admin/forms', 'items')
  if (key === 'buckets') return fetchItems('/api/admin/buckets', 'items')
  return { phase: 'loaded', items: [] }
}
