/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { CandidatePage } from './use-candidate-search'

/**
 * The one read a `user` picker makes, shared by the data table's cell editor
 * and the form's control so the two cannot disagree about who is offered or how
 * an account is labelled.
 *
 * Reads `GET /api/users/directory`, which returns `{ id, name, image }` and
 * deliberately no email — a picker needs a label, not an address, and that
 * endpoint is readable by every signed-in account. The column is a foreign key
 * into the user table, so the id is what gets written; the name is a label.
 *
 * The endpoint has no paging parameter and reports no pagination metadata, so
 * `hasMore` is always `false`.
 */

/** Server-side page size. Performance, not a boundary — see the route module. */
const DIRECTORY_LIMIT = 20

/** Stable cache key for the directory search. */
export const USER_DIRECTORY_SOURCE_KEY = 'user-directory'

interface DirectoryEntry {
  readonly id: string
  readonly name: string
  readonly image: string | null
}

export async function fetchUserDirectoryPage(
  term: string,
  signal: AbortSignal
): Promise<CandidatePage> {
  const params = new URLSearchParams({ limit: String(DIRECTORY_LIMIT) })
  if (term.trim() !== '') params.set('q', term.trim())
  const res = await fetch(`/api/users/directory?${params.toString()}`, {
    signal,
    credentials: 'include',
  })
  if (!res.ok) {
    throw new Error(`Failed to load the user directory: ${res.status}`)
  }
  const body = (await res.json()) as { users?: readonly DirectoryEntry[] }
  // An account with a blank name still has to be pickable, and its id is the
  // only thing left that identifies it.
  return {
    candidates: (body.users ?? []).map((entry) => ({
      value: String(entry.id),
      label: entry.name.trim() === '' ? String(entry.id) : entry.name,
    })),
    hasMore: false,
  }
}
