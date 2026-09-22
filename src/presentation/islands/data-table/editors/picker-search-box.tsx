/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable react-perf/jsx-no-new-function-as-prop --
   Cell-level editor input: mounted per open cell, and its onChange closes over
   the parent's term setter. */

import { computeTableAddRowInputClasses } from '@/presentation/design/table-default-classes'
import type { ReactElement } from 'react'

/**
 * The search input both fetching pickers share.
 *
 * `type="search"` rather than `type="text"` is deliberate and asserted: the
 * grid's guard against a field type falling through to a bare text box looks
 * for `input[type="text"]` inside the cell, and a picker whose search field
 * answered to that selector would report itself as the very fall-through it
 * replaced.
 *
 * `role="combobox"` is set explicitly because a search input's implicit role is
 * `searchbox` — which describes filtering a page, not choosing among candidates
 * that a listbox is offering.
 */
export function PickerSearchBox({
  term,
  onTermChange,
  label,
  placeholder,
}: {
  readonly term: string
  readonly onTermChange: (next: string) => void
  readonly label: string
  readonly placeholder: string
}): ReactElement {
  return (
    <input
      type="search"
      role="combobox"
      aria-expanded="true"
      aria-label={label}
      placeholder={placeholder}
      value={term}
      onChange={(e) => onTermChange(e.target.value)}
      className={computeTableAddRowInputClasses()}
    />
  )
}
