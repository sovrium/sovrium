/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useState } from 'react'
import { useCandidateSearch } from '../use-candidate-search'
import { fetchUserDirectoryPage, USER_DIRECTORY_SOURCE_KEY } from '../user-directory'
import { readLinkedIds, writeLinkedIds } from './record-picker-value'
import type { FieldDef } from './field-def'
import type { RecordPicker } from './use-record-picker'

/**
 * The form's people picker for a `user` column: the same {@link RecordPicker}
 * shape the relationship picker draws, fed by the account directory instead of
 * a related table — so the two pickers share their combobox, popup and
 * single-pick behaviour, and differ only in where candidates come from.
 *
 * Single-valued: a `user` column holds one account id, which is what the form
 * holds and sends. The label of a picked account is remembered on pick, and an
 * id seeded from a record resolves once the directory's first page lists it;
 * until then the id itself is shown rather than nothing.
 */
export function useUserPicker(args: {
  readonly field: FieldDef
  readonly value: string
  readonly onChange: (name: string, value: string) => void
}): RecordPicker {
  const { field, value, onChange } = args
  const linkedIds = readLinkedIds(value, false)
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<Readonly<Record<string, string>>>({})

  const fetchCandidates = useCallback(
    (term: string, _page: number, signal: AbortSignal) => fetchUserDirectoryPage(term, signal),
    []
  )
  const search = useCandidateSearch(fetchCandidates, USER_DIRECTORY_SOURCE_KEY)
  const known: Readonly<Record<string, string>> = {
    ...picked,
    ...Object.fromEntries(search.candidates.map((c) => [c.value, c.label])),
  }
  const labelOfId = (id: string): string => known[id] ?? id
  const searching = open || search.term !== ''
  const firstId = linkedIds[0]

  return {
    linkedIds,
    labelOfId,
    search,
    open,
    atCap: false,
    inputValue: searching || firstId === undefined ? search.term : labelOfId(firstId),
    openPopup: () => setOpen(true),
    closePopup: () => setOpen(false),
    setTerm: (term) => {
      search.setTerm(term)
      setOpen(true)
    },
    toggle: (id) => {
      setPicked((prev) => ({ ...prev, [id]: labelOfId(id) }))
      onChange(field.name, writeLinkedIds([id], false))
      search.setTerm('')
      setOpen(false)
    },
    remove: () => onChange(field.name, ''),
  }
}
