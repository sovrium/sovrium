/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useState, type Dispatch, type SetStateAction } from 'react'
import { isAtLinkCap } from '../../runtime/picker-contract'
import { createRelatedRecord, fetchCandidatePage } from '../record-candidates'
import { useCandidateSearch } from '../use-candidate-search'
import { CREATE_KEY, usePickerCreate } from '../use-picker-create'
import type { ListboxCandidate } from '../option-listbox'
import type { CandidateScope } from '../record-candidates'
import type { CandidateSearch } from '../use-candidate-search'
import type { PickerCreate } from '../use-picker-create'

/**
 * Everything the STANDALONE record picker knows, separated from what it draws.
 *
 * The unbound sibling of `crud-form/use-record-picker.ts`: same shared query,
 * same shared listbox, same cap arithmetic. The one real difference is where
 * the link goes. A form's picker writes a foreign KEY into a field and has to
 * resolve those keys back into labels on load; this one is not bound to a
 * column at all, so it holds the chosen CANDIDATES — label and key together —
 * and never has to look a label up.
 *
 * That is also why linked rows are removed from the offered list rather than
 * toggled in it: a chip already shows what is linked, so re-offering the row
 * would give the reader two places to unlink from and a second pick of the same
 * name would silently remove it.
 */
export interface StandalonePicker {
  /** The records currently linked, in the order they were chosen. */
  readonly linked: readonly ListboxCandidate[]
  /** Candidate search state, shared with the grid's and the form's pickers. */
  readonly search: CandidateSearch
  /** The candidates to OFFER — the search's, minus what is already linked. */
  readonly offered: readonly ListboxCandidate[]
  /** Whether the suggestions are showing. */
  readonly open: boolean
  /** Whether the link set has reached its declared `maxLinked` ceiling. */
  readonly atCap: boolean
  /** The related table's own refusal, verbatim, when the last create failed. */
  readonly createError: string | undefined
  readonly openPopup: () => void
  /** Type into the search box, which also opens the suggestions. */
  readonly setTerm: (term: string) => void
  /** Take a candidate, or the synthetic create row. */
  readonly choose: (key: string) => void
  /** Drop one link, from a chip's remove button. */
  readonly remove: (key: string) => void
}

/**
 * The candidate search, bound to ONE table and ONE scope.
 *
 * The scope is serialized rather than passed by reference: it arrives freshly
 * built from the island's props on every render, so a reference dependency
 * would re-run the search on each one. Serializing makes the identity the
 * scope's CONTENT, which is what "the search should re-run" actually means.
 */
function useScopedSearch(
  table: string,
  displayField: string | undefined,
  scope: CandidateScope
): CandidateSearch {
  const scopeKey = JSON.stringify(scope)
  const fetchCandidates = useCallback(
    async (term: string, page: number, signal: AbortSignal) =>
      fetchCandidatePage({
        relatedTable: table,
        displayField,
        term,
        page,
        signal,
        scope: JSON.parse(scopeKey) as CandidateScope,
      }),
    [table, displayField, scopeKey]
  )
  return useCandidateSearch(fetchCandidates, `${table}:${displayField ?? ''}:${scopeKey}`)
}

/**
 * The offered list, with the inline-create row appended when one is offered.
 *
 * `table` / `displayField` arrive together or not at all: an inline create
 * needs a column for the typed text to go into, so a picker that declares no
 * display column cannot offer one — the refusal `record-picker.ts` names.
 */
function useOfferedCandidates(args: {
  readonly offered: readonly ListboxCandidate[]
  readonly search: CandidateSearch
  readonly enabled: boolean
  readonly table?: string
  readonly displayField?: string
}): PickerCreate {
  const { offered, search, enabled, table, displayField } = args
  return usePickerCreate({
    candidates: offered,
    term: search.term.trim(),
    loading: search.loading,
    failed: search.failed,
    // Offered only when the search SETTLED ON NOTHING — the reading the shared
    // hook's own doc-comment describes. A create row beside real matches asks
    // the reader to judge, at the moment they are reading a list, whether the
    // row they want is one of the ones in front of them.
    enabled,
    ...(table !== undefined &&
      displayField !== undefined && {
        createFromTerm: (term: string) =>
          createRelatedRecord({ relatedTable: table, displayField, term }),
      }),
  })
}

/**
 * The two things CHOOSING does: link a candidate, or create one and link that.
 *
 * Outside the hook because neither is stateful in its own right — both are a
 * setter and a search reset — and keeping them here leaves the hook reading as
 * the list of decisions it makes rather than as their mechanics.
 */
function linkActions(args: {
  readonly multiple: boolean
  readonly search: CandidateSearch
  readonly create: PickerCreate
  readonly setLinked: Dispatch<SetStateAction<readonly ListboxCandidate[]>>
  readonly setOpen: Dispatch<SetStateAction<boolean>>
}): { readonly link: (candidate: ListboxCandidate) => void; readonly runCreate: () => void } {
  const { multiple, search, create, setLinked, setOpen } = args
  const link = (candidate: ListboxCandidate): void => {
    setLinked((current) => (multiple ? [...current, candidate] : [candidate]))
    // A single-valued pick answers the question, so the search resets and the
    // suggestions close rather than inviting a second choice that would
    // silently replace the first.
    if (multiple) return
    search.setTerm('')
    setOpen(false)
  }
  return {
    link,
    // The term clears the moment the write STARTS, so the create row does not
    // sit there offering itself a second time while the first is in flight —
    // and `create.run()` has already closed over the term, so clearing it
    // cannot lose what the reader wrote.
    runCreate: () => {
      const label = search.term.trim()
      const pending = create.run()
      search.setTerm('')
      void pending.then((id) => {
        if (id !== undefined) link({ value: id, label })
      })
    },
  }
}

export function useStandalonePicker(args: {
  readonly table: string
  readonly displayField: string | undefined
  readonly scope: CandidateScope
  readonly allowCreate: boolean
  readonly multiple: boolean
  readonly maxLinked: number | undefined
}): StandalonePicker {
  const { table, displayField, scope, allowCreate, multiple, maxLinked } = args
  const [linked, setLinked] = useState<readonly ListboxCandidate[]>([])
  const [open, setOpen] = useState(false)

  const search = useScopedSearch(table, displayField, scope)

  const atCap = isAtLinkCap(maxLinked, linked.length)
  const linkedKeys = new Set(linked.map((candidate) => candidate.value))
  const offered = search.candidates.filter((candidate) => !linkedKeys.has(candidate.value))

  const create = useOfferedCandidates({
    offered,
    search,
    enabled: !atCap && offered.length === 0,
    ...(allowCreate && displayField !== undefined && { table, displayField }),
  })

  const { link, runCreate } = linkActions({ multiple, search, create, setLinked, setOpen })

  return {
    linked,
    search,
    offered: create.candidates,
    open,
    atCap,
    createError: create.error,
    openPopup: () => setOpen(true),
    setTerm: (term) => {
      search.setTerm(term)
      setOpen(true)
    },
    choose: (key) => {
      if (atCap) return
      if (key === CREATE_KEY) return runCreate()
      const candidate = create.candidates.find((entry) => entry.value === key)
      if (candidate !== undefined) link(candidate)
    },
    remove: (key) => setLinked((current) => current.filter((entry) => entry.value !== key)),
  }
}
