/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeTableEditorLabelClasses,
  computeTableEditorListRowClasses,
  computeTableEditorPopoverClasses,
  computeTableEditorStripClasses,
} from '@/presentation/design/table-default-classes'
import { OptionListbox } from '../../parts/option-listbox'
import { LOAD_MORE_LABEL, linkCountLabel } from '../../runtime/picker-contract'
import type { ListboxCandidate } from '../../parts/option-listbox'
import type { ReactElement } from 'react'

/**
 * The three strips a fetching picker can hang under its listbox: the link
 * count, a refused inline create, and the next-page button.
 *
 * Split out of `fetching-picker.tsx` so that component stays inside the
 * `max-lines-per-function` ceiling. They share one visual contract — each is a
 * full-width strip under the candidate list, separated from it by a single rule.
 *
 * The strips used to carry their OWN border on three sides and be pulled up a
 * pixel to meet the listbox's, because the listbox was a bordered box and each
 * strip was another one. The popover now owns the border once and everything
 * here lives inside it, so the seam, the `-mt-px` that hid it, and the two
 * stacked 1px rules it produced when the browser rounded differently are all
 * gone.
 */

const STRIP = `${computeTableEditorStripClasses()} px-2 py-1`

/**
 * "N of N linked" — shown whenever the column declares a ceiling.
 *
 * The WORDING comes from {@link linkCountLabel}, shared with the form's own
 * link count; only the strip's chrome is local. The two surfaces differ in
 * where the count sits, never in what it says.
 */
export function LinkCount(props: {
  readonly linked: number
  readonly maxLinked: number
}): ReactElement {
  return (
    <span className={`${computeTableEditorLabelClasses()} ${STRIP}`}>
      {linkCountLabel(props.linked, props.maxLinked)}
    </span>
  )
}

/**
 * What the related table said when it refused an inline create.
 *
 * `role="alert"` because it appears in response to an action the reader just
 * took, on a surface they are already looking at.
 */
export function CreateRefusal(props: { readonly message: string }): ReactElement {
  return (
    <span
      role="alert"
      className={`text-error text-xs font-medium ${STRIP}`}
    >
      {props.message}
    </span>
  )
}

/** Fetches and appends the next page of candidates, in place. */
export function LoadMoreButton(props: { readonly onClick: () => void }): ReactElement {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`${computeTableEditorListRowClasses()} ${computeTableEditorStripClasses()} justify-center text-center`}
    >
      {LOAD_MORE_LABEL}
    </button>
  )
}

/**
 * The popup a fetching picker hangs under its search box: the listbox, then any
 * of the three strips above that apply.
 *
 * Extracted so `FetchingPicker` stays inside `max-lines-per-function`. The
 * grouping is not arbitrary — everything here is BELOW the search box and
 * shares its border stack, while the search box itself is a sibling.
 */
export function PickerPanel(props: {
  readonly candidates: readonly ListboxCandidate[]
  readonly selected: readonly string[]
  readonly onToggle: (value: string) => void
  readonly multiple: boolean
  readonly ariaLabel: string
  readonly emptyLabel: string
  readonly maxLinked?: number
  readonly createError?: string
  readonly hasMore: boolean
  readonly onLoadMore: () => void
}): ReactElement {
  return (
    <div className={`${computeTableEditorPopoverClasses({ layout: 'stacked' })} top-full left-0`}>
      <OptionListbox
        candidates={props.candidates}
        selected={props.selected}
        onToggle={props.onToggle}
        multiple={props.multiple}
        ariaLabel={props.ariaLabel}
        emptyLabel={props.emptyLabel}
      />
      {props.maxLinked !== undefined && (
        <LinkCount
          linked={props.selected.length}
          maxLinked={props.maxLinked}
        />
      )}
      {props.createError !== undefined && <CreateRefusal message={props.createError} />}
      {props.hasMore && <LoadMoreButton onClick={props.onLoadMore} />}
    </div>
  )
}
