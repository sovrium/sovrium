/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useState } from 'react'
import { isAtLinkCap, togglingIn } from '../../runtime/picker-contract'
import { fetchCandidatePage } from '../record-candidates'
import { useCandidateSearch } from '../use-candidate-search'
import { readLinkedIds, writeLinkedIds } from './record-picker-value'
import { useLinkedLabels } from './use-linked-labels'
import type { FieldDef } from './field-def'
import type { CandidateSearch } from '../use-candidate-search'

/**
 * Everything the form's record picker KNOWS, separated from everything it
 * DRAWS.
 *
 * The split is not only about the `max-lines-per-function` ceiling on island
 * components. Four decisions live here that are easy to get subtly wrong and
 * worth reading in one place: what the stored value means, what the search box
 * shows when nothing is being typed, when the cap closes the popup, and what a
 * single-valued pick does that a multi-valued one does not.
 */
export interface RecordPicker {
  /** The keys the field currently links to. */
  readonly linkedIds: readonly string[]
  /** The display label for a key, falling back to the key itself. */
  readonly labelOfId: (id: string) => string
  /** Candidate search state, shared with the grid's picker. */
  readonly search: CandidateSearch
  /** Whether the popup is showing. */
  readonly open: boolean
  /** Whether the field is at its declared `maxLinked` ceiling. */
  readonly atCap: boolean
  /** What the search box displays right now. */
  readonly inputValue: string
  readonly openPopup: () => void
  readonly closePopup: () => void
  /** Type into the search box, which also opens the popup. */
  readonly setTerm: (term: string) => void
  /** Pick or unpick a candidate. */
  readonly toggle: (id: string) => void
  /** Drop one link, from a chip's remove button. */
  readonly remove: (id: string) => void
}

/**
 * What the search box displays.
 *
 * A single-valued picker shows WHAT IS LINKED when it is not being searched; a
 * multi-valued one always shows the search term, because its links are the
 * chips beside it rather than text inside it.
 */
const displayedTerm = (args: {
  readonly allowMultiple: boolean
  readonly searching: boolean
  readonly term: string
  readonly linkedLabel: string
}): string => (args.allowMultiple || args.searching ? args.term : args.linkedLabel)

/**
 * Candidate search bound to one related table, through the SAME hook the grid's
 * picker uses. A field declaring no `relatedTable` searches nothing rather than
 * erroring: the control still renders, and says so.
 */
function useRelatedSearch(
  relatedTable: string | undefined,
  displayField: string | undefined
): CandidateSearch {
  const fetchCandidates = useCallback(
    async (term: string, page: number, signal: AbortSignal) =>
      relatedTable
        ? fetchCandidatePage({ relatedTable, displayField, term, page, signal })
        : { candidates: [], hasMore: false },
    [relatedTable, displayField]
  )
  return useCandidateSearch(fetchCandidates, `${relatedTable ?? ''}:${displayField ?? ''}`)
}

export function useRecordPicker(args: {
  readonly field: FieldDef
  readonly value: string
  readonly onChange: (name: string, value: string) => void
}): RecordPicker {
  const { field, value, onChange } = args
  const { relatedTable, displayField, maxLinked } = field
  const allowMultiple = field.allowMultiple === true
  const linkedIds = readLinkedIds(value, allowMultiple)

  const [open, setOpen] = useState(false)
  const search = useRelatedSearch(relatedTable, displayField)
  const labels = useLinkedLabels({
    relatedTable,
    displayField,
    linkedIds,
    candidates: search.candidates,
  })
  const labelOfId = (id: string): string => labels[id] ?? id

  const commit = (ids: readonly string[]): void =>
    onChange(field.name, writeLinkedIds(ids, allowMultiple))

  return {
    linkedIds,
    labelOfId,
    search,
    open,
    // A cap only closes the popup once it is REACHED. Below it the picker
    // behaves exactly as an uncapped one. The inclusive boundary is shared with
    // the grid's picker and with the server-side rule.
    atCap: isAtLinkCap(maxLinked, linkedIds.length),
    inputValue: displayedTerm({
      allowMultiple,
      searching: open || search.term !== '',
      term: search.term,
      linkedLabel: linkedIds[0] === undefined ? '' : labelOfId(linkedIds[0]),
    }),
    openPopup: () => setOpen(true),
    closePopup: () => setOpen(false),
    setTerm: (term) => {
      search.setTerm(term)
      setOpen(true)
    },
    toggle: (id) => {
      if (allowMultiple) return commit(togglingIn(linkedIds, id))
      // Single-valued: one pick answers the question, so the search resets and
      // the popup closes rather than inviting a second choice that would
      // silently replace the first.
      commit([id])
      search.setTerm('')
      setOpen(false)
    },
    remove: (id) => commit(linkedIds.filter((entry) => entry !== id)),
  }
}
