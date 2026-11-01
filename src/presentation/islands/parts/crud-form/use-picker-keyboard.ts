/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useState, type KeyboardEvent } from 'react'

/**
 * The combobox keyboard pattern a form picker owes its reader, shared by the
 * relationship picker and the people picker so the two cannot disagree.
 *
 * ArrowDown and ArrowUp move one highlight through the suggestions (opening
 * the list when it is closed). While the list is open, Enter picks the
 * highlighted suggestion and never sends the form: a form sent then would save
 * the link the field held before, not the name the reader is looking at.
 * Escape closes the list and goes no further, so a sheet or dialog around the
 * field stays open.
 */
export interface PickerKeyboard {
  /** The suggestion the arrow keys have highlighted, or -1. */
  readonly highlight: number
  /** Forget the highlight — a new term draws a new list. */
  readonly resetHighlight: () => void
  readonly onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
}

/** The next highlight for an arrow key, held within the list. */
const movedHighlight = (key: string, highlight: number, count: number): number =>
  key === 'ArrowDown' ? Math.min(highlight + 1, count - 1) : Math.max(highlight - 1, 0)

export function usePickerKeyboard(args: {
  readonly open: boolean
  readonly setOpen: (open: boolean) => void
  readonly candidates: readonly { readonly value: string }[]
  readonly pick: (id: string) => void
}): PickerKeyboard {
  const [held, setHeld] = useState(-1)
  // The highlight names a row of the list on screen: a closed list has none.
  const highlight = args.open ? held : -1

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    const { key } = event
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      event.preventDefault()
      args.setOpen(true)
      if (args.candidates.length > 0) {
        setHeld(movedHighlight(key, highlight, args.candidates.length))
      }
      return
    }
    if (!args.open) return
    if (key === 'Enter') {
      event.preventDefault()
      const chosen = args.candidates[highlight]
      if (chosen !== undefined) args.pick(chosen.value)
      return
    }
    if (key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      args.setOpen(false)
    }
  }

  return { highlight, resetHighlight: () => setHeld(-1), onKeyDown }
}
