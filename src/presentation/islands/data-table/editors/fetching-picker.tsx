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

import { useCandidateSearch } from '../../parts/use-candidate-search'
import { usePickerCreate } from '../../parts/use-picker-create'
import { readsAsList } from '../../runtime/cell-value-semantics'
import { isAtLinkCap, resolvePickerEmptyLabel } from '../../runtime/picker-contract'
import { EditorPopover } from './editor-popover'
import { PickerPanel } from './picker-footnotes'
import { PickerSearchBox } from './picker-search-box'
import { usePickerSelection } from './use-picker-selection'
import type { CellEditorProps } from './editor-contract'
import type { CreateRelatedOutcome } from '../../parts/record-candidates'
import type { CandidatePage } from '../../parts/use-candidate-search'
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
    page: number,
    signal: AbortSignal
  ) => Promise<CandidatePage>
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
  /**
   * Creates a record from the typed text and returns its key, when the field
   * both declares `allowCreate` and the caller may create in the related table.
   * Absent means no create affordance is offered at all — ABSENT rather than
   * disabled, because a disabled control still tells a caller the related table
   * exists and what it would accept.
   */
  readonly createFromTerm?: (term: string) => Promise<CreateRelatedOutcome>
  /** Ceiling on how many records the column may link to. Uncapped when absent. */
  readonly maxLinked?: number
}

/**
 * This picker's props in the shape {@link resolvePickerEmptyLabel} takes.
 *
 * A mechanical adapter, kept out of the component so the render stays under
 * `max-lines-per-function`. The PRECEDENCE it delegates to is shared with the
 * form's picker; only the plumbing is local.
 */
function emptyLabelFor(
  props: FetchingPickerProps,
  search: { readonly failed: boolean; readonly loading: boolean }
): string {
  return resolvePickerEmptyLabel({
    failed: search.failed,
    loading: search.loading,
    emptyLabel: props.emptyLabel,
    failedLabel: props.failedLabel,
    ...(props.unconfiguredLabel !== undefined && { unconfiguredLabel: props.unconfiguredLabel }),
  })
}

export function FetchingPicker(props: FetchingPickerProps): ReactElement {
  const { value, commit, cancel, tabNext, fieldName, allowMultiple, maxLinked } = props
  const selected = readsAsList(value)
  const search = useCandidateSearch(props.fetchCandidates, props.sourceKey)

  // At the cap the listbox STAYS OPEN here, unlike on the form. That is not an
  // inconsistency: the form renders its links as removable chips, so it can
  // afford to close the list, while this listbox IS the only place a grid cell
  // can unlink something. Closing it would make the cap a latch nothing could
  // release.
  const atCap = isAtLinkCap(maxLinked, selected.length)
  const create = usePickerCreate({
    candidates: search.candidates,
    term: search.term.trim(),
    loading: search.loading,
    failed: search.failed,
    enabled: !atCap,
    ...(props.createFromTerm && { createFromTerm: props.createFromTerm }),
  })

  const { choose } = usePickerSelection({
    selected,
    allowMultiple,
    atCap,
    commit,
    cancel,
    runCreate: create.run,
  })

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
      <PickerPanel
        candidates={create.candidates}
        selected={selected}
        onToggle={choose}
        multiple={allowMultiple}
        ariaLabel={props.listLabel}
        emptyLabel={emptyLabelFor(props, search)}
        hasMore={search.hasMore}
        onLoadMore={search.loadMore}
        {...(maxLinked !== undefined && { maxLinked })}
        {...(create.error !== undefined && { createError: create.error })}
      />
    </EditorPopover>
  )
}
