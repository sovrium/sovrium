/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable react-perf/jsx-no-new-function-as-prop --
   Cell-level editor: one listbox is mounted per open cell and torn down on
   commit or cancel, and its handlers close over the draft selection. Hoisting
   them would add indirection without removing re-render work, because picking
   an option IS the state change that re-renders the list. */

import type { ReactElement } from 'react'

/**
 * The listbox every option-picking cell editor is built from.
 *
 * Three editors need the same surface — the `multi-select` cell picks from
 * declared options, the record picker from a searched related table, the user
 * picker from the account directory — and they differ only in where the
 * candidates come from. Sharing the LIST means they cannot disagree about
 * roles, keyboard handling or dismissal, which is the drift that this whole
 * story exists to undo one level up.
 *
 * `role="listbox"` / `role="option"` are load-bearing rather than decorative:
 * they are what makes the control announce itself as a choice among candidates
 * rather than a box that happens to contain words.
 */

export interface ListboxCandidate {
  /** The value written to the column. */
  readonly value: string
  /** What the operator reads. Never an email, never a bare key. */
  readonly label: string
  /** Optional chip fill, for vocabularies whose colours the author declared. */
  readonly color?: string
}

interface OptionListboxProps {
  readonly candidates: readonly ListboxCandidate[]
  /** Values currently selected. A single-valued field carries at most one. */
  readonly selected: readonly string[]
  readonly onToggle: (value: string) => void
  /** Rendered when the candidate list is empty, so the cell is never a blank box. */
  readonly emptyLabel: string
  readonly ariaLabel: string
  readonly multiple: boolean
}

const OPTION_CLASS =
  'flex w-full cursor-pointer items-center gap-2 px-2 py-1 text-left text-sm ' +
  'hover:bg-background-subtle aria-selected:font-medium'

export function OptionListbox({
  candidates,
  selected,
  onToggle,
  emptyLabel,
  ariaLabel,
  multiple,
}: OptionListboxProps): ReactElement {
  return (
    <ul
      role="listbox"
      aria-label={ariaLabel}
      {...(multiple && { 'aria-multiselectable': true })}
      className="border-border bg-background max-h-56 min-w-40 overflow-auto rounded border py-1 shadow-md"
    >
      {candidates.length === 0 ? (
        <li className="text-foreground-muted px-2 py-1 text-sm">{emptyLabel}</li>
      ) : (
        candidates.map((candidate) => {
          const isSelected = selected.includes(candidate.value)
          return (
            <li
              key={candidate.value}
              role="option"
              aria-selected={isSelected}
              tabIndex={-1}
              className={OPTION_CLASS}
              onClick={() => onToggle(candidate.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return
                e.preventDefault()
                onToggle(candidate.value)
              }}
            >
              <span
                aria-hidden="true"
                className="w-3 shrink-0 text-xs"
              >
                {isSelected ? '✓' : ''}
              </span>
              <span
                className="truncate"
                {...(candidate.color && {
                  style: { color: candidate.color },
                })}
              >
                {candidate.label}
              </span>
            </li>
          )
        })
      )}
    </ul>
  )
}
