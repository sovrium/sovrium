/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { CREATE_KEY } from '../../parts/use-picker-create'
import { togglingIn } from '../../runtime/picker-contract'
import type { FieldWriteValue } from '../../hooks/use-inline-editing'

/**
 * What choosing a row in a fetching picker DOES.
 *
 * Split out of `fetching-picker.tsx` so that component stays inside its
 * `max-lines-per-function` ceiling, and because the three rules here are worth
 * reading together: single-valued commits and closes, multi-valued toggles and
 * stays open, and a picker at its cap honours a DESELECT but not an addition.
 */
export interface PickerSelection {
  /** Commit a real record key, toggling it when the field is multi-valued. */
  readonly link: (key: string) => void
  /** Handle a row the reader activated, including the synthetic create row. */
  readonly choose: (key: string) => void
}

export function usePickerSelection(args: {
  readonly selected: readonly string[]
  readonly allowMultiple: boolean
  readonly atCap: boolean
  readonly commit: (value: FieldWriteValue) => void
  readonly cancel: () => void
  readonly runCreate: () => Promise<string | undefined>
}): PickerSelection {
  const { selected, allowMultiple, atCap, commit, cancel, runCreate } = args

  const link = (key: string): void => {
    // The same toggle the FORM's picker performs — shared so "picking an
    // already-linked row unlinks it" cannot come to mean two things.
    const next: FieldWriteValue = allowMultiple ? togglingIn(selected, key) : key
    commit(next)
    // A single-valued field is done the moment one candidate is chosen; a
    // multi-valued one stays open so the next can be picked.
    if (!allowMultiple) cancel()
  }

  const choose = (key: string): void => {
    if (key === CREATE_KEY) {
      void runCreate().then((id) => {
        if (id !== undefined) link(id)
      })
      return
    }
    // At the cap, only a DESELECT is honoured.
    if (atCap && !selected.includes(key)) return
    link(key)
  }

  return { link, choose }
}
