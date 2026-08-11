/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Data helpers for the `admin-command-palette` island
 *.
 *
 * [internal ref] broadened the palette from a fixed client-side page-jump list
 * into a CROSS-ENTITY GLOBAL SEARCH: typing queries `GET /api/admin/search?q=`
 * (debounced) and renders the matches GROUPED BY TYPE, each result carrying a
 * per-type badge and a deep-link the palette navigates to (via the SPA path).
 * The seven entity kinds and their French operator labels are defined here.
 */

/**
 * The closed set of admin entity kinds the global search spans — mirrors the
 * server `adminSearchEntityTypeSchema` enum.
 */
export type AdminSearchEntityType =
  'record' | 'submission' | 'run' | 'user' | 'file' | 'conversation' | 'connection'

/** One global-search result (the S4 allow-list shape the endpoint returns). */
export interface AdminSearchResult {
  readonly type: AdminSearchEntityType
  readonly entityId: string
  readonly title: string
  readonly href: string
  readonly updatedAt: string
}

/** One per-type result group. */
export interface AdminSearchGroup {
  readonly type: AdminSearchEntityType
  readonly results: ReadonlyArray<AdminSearchResult>
}

/** The `GET /api/admin/search` response body. */
export interface AdminSearchResponse {
  readonly query: string
  readonly groups: ReadonlyArray<AdminSearchGroup>
}

/**
 * French operator label per entity kind — the group heading + the per-result
 * type badge. Plural (a group label) by design.
 */
export const ENTITY_TYPE_LABELS: Readonly<Record<AdminSearchEntityType, string>> = {
  record: 'Records',
  submission: 'Submissions',
  run: 'Runs',
  user: 'Users',
  file: 'Files',
  conversation: 'Conversations',
  connection: 'Connections',
}

/**
 * Fetch the global search for `query`. Returns the parsed response, or
 * `undefined` on any non-OK / network / parse failure (the caller renders the
 * no-results state). A blank query never reaches here (the island short-circuits
 * to the empty prompt).
 */
export async function fetchAdminSearch(query: string): Promise<AdminSearchResponse | undefined> {
  try {
    const response = await fetch(`/api/admin/search?q=${encodeURIComponent(query)}`, {
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) return undefined
    return (await response.json()) as AdminSearchResponse
  } catch {
    return undefined
  }
}
