/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  pickerWord,
  resolvePickerEmptyLabel,
  type PickerWords,
} from '../../runtime/picker-contract'
import { OptionListbox } from '../option-listbox'
import { CandidateFooter } from './record-picker-chrome'
import type { StandalonePicker } from './use-standalone-picker'
import type { ReactElement } from 'react'

/**
 * Nothing is ever pre-selected in this listbox.
 *
 * A linked record leaves the offered list and becomes a chip, so the list only
 * ever holds rows that are NOT linked. Hoisted so the empty array is one value
 * rather than a fresh one per render.
 */
const NOTHING_SELECTED: readonly string[] = []

/**
 * What the picker OFFERS: the shared listbox, and what sits under it.
 *
 * The listbox is the same component the grid's and the form's pickers draw, so
 * the three cannot disagree about roles, keyboard handling or what a candidate
 * looks like. What differs is only the footer — this surface reads the
 * endpoint's total and can say how many there were.
 */
export function PickerSuggestions({
  listboxId,
  picker,
  multiple,
  words,
}: {
  readonly listboxId: string
  readonly picker: StandalonePicker
  readonly multiple: boolean
  /** The picker's words in the page language (`picker.*`), where they differ from English. */
  readonly words?: PickerWords
}): ReactElement {
  const { search } = picker
  return (
    <div id={listboxId}>
      <OptionListbox
        candidates={picker.offered}
        selected={NOTHING_SELECTED}
        onToggle={picker.choose}
        multiple={multiple}
        ariaLabel="Suggestions"
        emptyLabel={resolvePickerEmptyLabel({
          failed: search.failed,
          loading: search.loading,
          emptyLabel: pickerWord(words, 'picker.noMatchingRecords'),
          failedLabel: pickerWord(words, 'picker.loadFailed'),
          searchingLabel: pickerWord(words, 'picker.searching'),
        })}
      />
      <CandidateFooter
        shown={search.candidates.length}
        total={search.total}
        hasMore={search.hasMore}
        onLoadMore={search.loadMore}
        words={words}
      />
    </div>
  )
}
