/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable react-perf/jsx-no-new-function-as-prop --
   One picker is mounted per declaration; these handlers close over that
   picker's search term and link set, which is the state that re-renders them. */

import { computeFormControlClasses } from '@/presentation/design/form-layout-classes'
import {
  SEARCH_BY_ID_LABEL,
  candidateCountLabel,
  linkCountLabel,
  loadMoreCountLabel,
} from '../../runtime/picker-contract'
import type { ListboxCandidate } from '../option-listbox'
import type { ReactElement } from 'react'

/**
 * The parts of the standalone record picker that hold no state.
 *
 * Split out of `record-picker-island.tsx` so that island file stays under the
 * per-island `max-lines` cap — the same
 * split, for the same reason, as the form picker's own chrome module.
 */

/** The canonical input surface, shared with the other form controls. */
const CONTROL_CLASS = computeFormControlClasses()

/**
 * The search box, and the sentence that says what is being searched.
 *
 * `role="combobox"` rather than a text input with a list beside it: that role
 * is what makes the control announce itself as a choice among candidates.
 *
 * The "Search by id" line is not decoration. A picker whose author declared no
 * display column has to search by something, and guessing a column would work
 * on the table in front of them and fail silently on the next one — so it says
 * what it is doing and the reader can fix the config or use the id.
 */
export function PickerSearchRow({
  listboxId,
  term,
  expanded,
  hasDisplayField,
  onTerm,
  onOpen,
}: {
  readonly listboxId: string
  readonly term: string
  readonly expanded: boolean
  readonly hasDisplayField: boolean
  readonly onTerm: (next: string) => void
  readonly onOpen: () => void
}): ReactElement {
  return (
    <>
      <input
        type="text"
        role="combobox"
        aria-expanded={expanded}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-label={hasDisplayField ? 'Search records' : SEARCH_BY_ID_LABEL}
        autoComplete="off"
        value={term}
        className={`${CONTROL_CLASS} w-full`}
        onChange={(event) => onTerm(event.target.value)}
        onFocus={onOpen}
      />
      {!hasDisplayField && (
        <span className="text-foreground-muted text-sm">{SEARCH_BY_ID_LABEL}</span>
      )}
    </>
  )
}

/**
 * What sits under the suggestions: the next page, or how many there were.
 *
 * The two are mutually exclusive by construction, and that IS the rule. While a
 * page is outstanding the list says there are more; only once it is complete
 * can it report a total, because a count over a paged result is a claim about
 * the table the response cannot support — and a reader who sees a total assumes
 * they are looking at all of it.
 */
export function CandidateFooter({
  shown,
  total,
  hasMore,
  onLoadMore,
}: {
  readonly shown: number
  readonly total: number | undefined
  readonly hasMore: boolean
  readonly onLoadMore: () => void
}): ReactElement | undefined {
  if (hasMore) {
    const remaining = total === undefined ? undefined : Math.max(total - shown, 1)
    return (
      <button
        type="button"
        // The pointer-down default is prevented so the combobox's own blur does
        // not close the suggestions before the click lands on this button.
        onMouseDown={(event) => event.preventDefault()}
        onClick={onLoadMore}
        className="border-border bg-background-raised text-foreground-muted hover:bg-background-subtle -mt-px w-full border-x border-b py-1 text-center text-sm"
      >
        {loadMoreCountLabel(remaining ?? shown)}
      </button>
    )
  }
  if (total === undefined) return undefined
  return (
    <span className="text-foreground-muted block py-1 text-sm">
      {candidateCountLabel(shown, total)}
    </span>
  )
}

/** "N of N linked" — shown whenever the picker declares a ceiling. */
export function LinkCountStrip({
  linked,
  maxLinked,
}: {
  readonly linked: number
  readonly maxLinked: number
}): ReactElement {
  return <span className="text-foreground-muted text-sm">{linkCountLabel(linked, maxLinked)}</span>
}

/**
 * The read-only rendering: NOT a combobox.
 *
 * A control that cannot be opened must not announce itself as one, and the
 * reader sees the resolved display values rather than the keys behind them.
 */
export function ReadOnlyLinks({
  id,
  className,
  label,
  links,
  placeholder,
}: {
  readonly id?: string
  readonly className?: string
  readonly label?: string
  readonly links: readonly ListboxCandidate[]
  readonly placeholder?: string
}): ReactElement {
  return (
    <div
      id={id}
      className={className}
    >
      {label !== undefined && <span className="text-foreground text-sm font-medium">{label}</span>}
      <span className="text-foreground text-md">
        {links.length === 0 ? (placeholder ?? '') : links.map((link) => link.label).join(', ')}
      </span>
    </div>
  )
}
