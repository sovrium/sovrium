/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback } from 'react'
import { editMetaOf, type CellEditorProps } from './editor-contract'
import { FetchingPicker } from './fetching-picker'
import type { CandidatePage } from '../../parts/use-candidate-search'
import type { ReactElement } from 'react'

/**
 * The `user` cell editor.
 *
 * Reads `GET /api/users/directory`, which returns `{ id, name, image }` and
 * deliberately no email — a picker needs a label, not an address, and that
 * endpoint is readable by every signed-in account. See the route module for the
 * full reasoning, including why it is flat rather than organization-scoped and
 * why agent accounts are excluded by email suffix.
 *
 * The column is a foreign key into the Better Auth user table, so the id is
 * what gets written; the display name is only ever a label.
 */

/** Server-side page size. Performance, not a boundary — see the route module. */
const CANDIDATE_LIMIT = 20

interface DirectoryEntry {
  readonly id: string
  readonly name: string
  readonly image: string | null
}

export function UserPickerEditor(props: CellEditorProps): ReactElement {
  const { allowMultiple } = editMetaOf(props.fieldMeta)

  // The directory endpoint has no `page`/`offset` parameter and reports no
  // pagination metadata (see the route module), so this picker cannot page —
  // `hasMore` is always `false` and the second argument goes unused.
  const fetchCandidates = useCallback(
    async (term: string, _page: number, signal: AbortSignal): Promise<CandidatePage> => {
      const params = new URLSearchParams({ limit: String(CANDIDATE_LIMIT) })
      if (term.trim() !== '') params.set('q', term.trim())
      const res = await fetch(`/api/users/directory?${params.toString()}`, {
        signal,
        credentials: 'include',
      })
      if (!res.ok) {
        // eslint-disable-next-line functional/no-throw-statements -- The search hook reports a failed load distinctly from an empty one.
        throw new Error(`Failed to load the user directory: ${res.status}`)
      }
      const body = (await res.json()) as { users?: readonly DirectoryEntry[] }
      // An account with a blank name still has to be pickable, and its id is
      // the only thing left that identifies it.
      return {
        candidates: (body.users ?? []).map((entry) => ({
          value: String(entry.id),
          label: entry.name.trim() === '' ? String(entry.id) : entry.name,
        })),
        hasMore: false,
      }
    },
    []
  )

  return (
    <FetchingPicker
      {...props}
      fetchCandidates={fetchCandidates}
      sourceKey="user-directory"
      allowMultiple={allowMultiple === true}
      searchLabel="Search people"
      searchPlaceholder="Search by name"
      listLabel={props.fieldName ?? 'People'}
      emptyLabel="No matching people"
      failedLabel="Could not load the directory"
    />
  )
}
