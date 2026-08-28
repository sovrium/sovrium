/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Lazy-load data for the Application-section sidebar disclosures
 *. Each Application destination
 * (Records / Submissions / Files / Conversations) is a Notion-style toggle that
 * fetches its object list on FIRST expand — tables from
 * `GET /api/admin/tables/overview`, forms from `GET /api/admin/forms`, buckets
 * from `GET /api/admin/buckets`, agents from `GET /api/admin/agents`. This module
 * owns the four reads + their shared load-state shape so the disclosure component
 * stays a thin render. Every read is admin-only (S1: a non-admin gets a 404
 * envelope, surfaced as the error state).
 *
 * The object list is an HTTP read, NOT the app config the surface builder sees.
 * That is the whole reason each endpoint projects its names through the SAME
 * shared function the surface uses (`declaredBucketNames`, `declaredAgentNames`):
 * two independent enumerations would let the sidebar advertise an object the page
 * cannot open.
 */

/** A loaded object in a sidebar group: a name that deep-links to `/_admin/{key}/{name}`. */
export interface SidebarGroupItem {
  /** The object name (table / form / bucket) — the `/_admin/{key}/{name}` segment. */
  readonly name: string
}

/** The lazy-load lifecycle of a sidebar group's object list. */
export type GroupLoadPhase = 'idle' | 'loading' | 'loaded' | 'error'

/** The fetched state of a sidebar group: its phase + (when loaded) its items. */
export interface GroupLoadState {
  readonly phase: GroupLoadPhase
  readonly items: ReadonlyArray<SidebarGroupItem>
}

/** The idle (not-yet-fetched) state — the disclosure starts collapsed + unfetched. */
export const IDLE_GROUP_STATE: GroupLoadState = { phase: 'idle', items: [] }

/** Coerce an unknown JSON value to a `{ name }` item, or `undefined` when nameless. */
function toItem(raw: unknown): SidebarGroupItem | undefined {
  if (raw === null || typeof raw !== 'object') return undefined
  const { name } = raw as { readonly name?: unknown }
  return typeof name === 'string' && name.length > 0 ? { name } : undefined
}

/**
 * GET a JSON endpoint and project the named array into `{ name }` items. The
 * array lives under different keys per endpoint: tables-overview nests it under
 * `by_table`, while the forms + buckets lists use the cursor-paginated `items`.
 */
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

/**
 * Fetch the object list for a sidebar group key. Returns a `loaded` state (with
 * items, possibly empty) or an `error` state — never throws, so the disclosure
 * can render a calm state for any outcome. Only the four Application toggles
 * have a list source; any other key resolves to an empty `loaded` state.
 */
export async function fetchGroupItems(key: string): Promise<GroupLoadState> {
  if (key === 'tables') return fetchItems('/api/admin/tables/overview', 'by_table')
  if (key === 'forms') return fetchItems('/api/admin/forms', 'items')
  if (key === 'buckets') return fetchItems('/api/admin/buckets', 'items')
  if (key === 'agents') return fetchItems('/api/admin/agents', 'items')
  return { phase: 'loaded', items: [] }
}
