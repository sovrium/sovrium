/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback } from 'react'
import { editMetaOf, type CellEditorProps } from './editor-contract'
import { FetchingPicker } from './fetching-picker'
import type { ListboxCandidate } from './option-listbox'
import type { ReactElement } from 'react'

/**
 * The `relationship` cell editor.
 *
 * Searches the related table on the field's declared `displayField` — the one
 * property that names a human-readable column on the other side. It was
 * declared with zero readers repo-wide until this editor; a picker without it
 * can only offer primary keys, which is what the operator was being asked to
 * type before.
 *
 * Searching "every readable text column" was refused: it makes the query shape
 * depend on the related table's width, and a match on a column the caller
 * cannot read would leak that column's contents through the result set. One
 * declared column is predictable and auditable. When `displayField` is absent
 * the picker offers ids and says so, rather than guessing a column.
 *
 * `limitToView` does not participate. It is also dead, and waking it means
 * resolving a named view with its filters and sort at query time — a larger
 * feature with its own permission surface. It stays tracked.
 *
 * `many-to-many` is out of scope by construction: it creates a junction table
 * rather than a column, so there is nothing on this record to write.
 */

/** Server-side page size for candidates. A picker is a shortlist, not a table. */
const CANDIDATE_LIMIT = 20

interface RecordRow {
  readonly id?: unknown
  readonly fields?: Readonly<Record<string, unknown>>
  readonly [key: string]: unknown
}

function buildCandidatesUrl(relatedTable: string, displayField: string | undefined, term: string) {
  const params = new URLSearchParams({ limit: String(CANDIDATE_LIMIT), sort: 'id:asc' })
  if (displayField && term.trim() !== '') {
    params.set(
      'filter',
      JSON.stringify({ and: [{ field: displayField, operator: 'contains', value: term.trim() }] })
    )
  }
  return `/api/tables/${encodeURIComponent(relatedTable)}/records?${params.toString()}`
}

function rowToCandidate(row: RecordRow, displayField: string | undefined): ListboxCandidate {
  const flat = { ...row, ...(row.fields ?? {}) }
  const key = String(flat.id ?? '')
  const label = displayField ? flat[displayField] : undefined
  // A row whose display column is empty still has to be pickable, and the key is
  // the only thing left that identifies it.
  return { value: key, label: label === undefined || label === null ? key : String(label) }
}

export function RecordPickerEditor(props: CellEditorProps): ReactElement {
  const { relatedTable, displayField, allowMultiple } = editMetaOf(props.fieldMeta)

  const fetchCandidates = useCallback(
    async (term: string, signal: AbortSignal): Promise<readonly ListboxCandidate[]> => {
      if (!relatedTable) return []
      const res = await fetch(buildCandidatesUrl(relatedTable, displayField, term), {
        signal,
        credentials: 'include',
      })
      if (!res.ok) {
        // eslint-disable-next-line functional/no-throw-statements -- The search hook reports a failed load distinctly from an empty one.
        throw new Error(`Failed to load ${relatedTable} candidates: ${res.status}`)
      }
      const body = (await res.json()) as { records?: readonly RecordRow[] }
      return (body.records ?? []).map((row) => rowToCandidate(row, displayField))
    },
    [relatedTable, displayField]
  )

  return (
    <FetchingPicker
      {...props}
      fetchCandidates={fetchCandidates}
      sourceKey={`${relatedTable ?? ''}:${displayField ?? ''}`}
      allowMultiple={allowMultiple === true}
      searchLabel={`Search ${relatedTable ?? 'records'}`}
      searchPlaceholder={displayField ? `Search by ${displayField}` : 'Search by id'}
      listLabel={props.fieldName ?? 'Linked records'}
      emptyLabel="No matching records"
      failedLabel="Could not load records"
      {...(relatedTable === undefined && {
        unconfiguredLabel: 'This field declares no related table',
      })}
    />
  )
}
