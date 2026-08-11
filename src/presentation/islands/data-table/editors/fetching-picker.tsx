/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable unicorn/no-null --
   `null` is the value that CLEARS a column: it is SQL NULL on the wire, while
   `undefined` is dropped by JSON.stringify and reaches the endpoint as "leave
   this field alone". The two are not interchangeable here — swapping them turns
   every clear gesture into a silent no-op. */

/* eslint-disable react-perf/jsx-no-new-function-as-prop --
   One picker is mounted per open cell and torn down on commit or cancel; its
   handlers close over that cell's draft selection and search term. */

import { readsAsList } from '../../shared/cell-value-semantics'
import { EditorPopover } from './editor-popover'
import { OptionListbox } from './option-listbox'
import { PickerSearchBox } from './picker-search-box'
import { useCandidateSearch } from './use-candidate-search'
import type { CellEditorProps } from './editor-contract'
import type { ListboxCandidate } from './option-listbox'
import type { ReactElement } from 'react'

/**
 * The shape both fetching pickers share.
 *
 * The record picker and the user picker differ ONLY in where their candidates
 * come from and what they are called. Everything else — the search box, the
 * listbox, single-versus-multiple selection, what Tab carries out of the cell,
 * how an empty list explains itself — is identical, and this story exists
 * because two copies of one decision drifted apart. Writing the second picker
 * as a second copy of the first would have been the same mistake one level
 * down.
 */
export interface FetchingPickerProps extends CellEditorProps {
  /** Fetches one capped page of candidates for a search term. */
  readonly fetchCandidates: (
    term: string,
    signal: AbortSignal
  ) => Promise<readonly ListboxCandidate[]>
  /** Re-runs the search when it changes — the endpoint or table being searched. */
  readonly sourceKey: string
  /** Whether the column holds a LIST of keys rather than one. */
  readonly allowMultiple: boolean
  readonly searchLabel: string
  readonly searchPlaceholder: string
  readonly listLabel: string
  /** Shown when the search returns nothing and nothing went wrong. */
  readonly emptyLabel: string
  /** Shown when the candidate request itself failed. */
  readonly failedLabel: string
  /** Shown when the field is misconfigured such that no search is possible. */
  readonly unconfiguredLabel?: string
}

function resolveEmptyLabel(
  props: FetchingPickerProps,
  search: { readonly failed: boolean; readonly loading: boolean }
): string {
  if (props.unconfiguredLabel) return props.unconfiguredLabel
  if (search.failed) return props.failedLabel
  return search.loading ? 'Searching…' : props.emptyLabel
}

export function FetchingPicker(props: FetchingPickerProps): ReactElement {
  const { value, commit, cancel, tabNext, fieldName, allowMultiple } = props
  const selected = readsAsList(value)
  const search = useCandidateSearch(props.fetchCandidates, props.sourceKey)

  const choose = (key: string): void => {
    const next = allowMultiple
      ? selected.includes(key)
        ? selected.filter((entry) => entry !== key)
        : [...selected, key]
      : key
    commit(next)
    // A single-valued field is done the moment one candidate is chosen; a
    // multi-valued one stays open so the next can be picked.
    if (!allowMultiple) cancel()
  }

  return (
    <EditorPopover
      label={`Edit ${fieldName ?? 'value'}`}
      cancel={cancel}
      tabValue={() => (allowMultiple ? selected : (selected[0] ?? null))}
      {...(tabNext && { tabNext })}
    >
      <PickerSearchBox
        term={search.term}
        onTermChange={search.setTerm}
        label={props.searchLabel}
        placeholder={props.searchPlaceholder}
      />
      <div className="absolute top-full left-0 z-20">
        <OptionListbox
          candidates={search.candidates}
          selected={selected}
          onToggle={choose}
          multiple={allowMultiple}
          ariaLabel={props.listLabel}
          emptyLabel={resolveEmptyLabel(props, search)}
        />
      </div>
    </EditorPopover>
  )
}
