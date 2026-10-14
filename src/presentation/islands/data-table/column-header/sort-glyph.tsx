/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeTableSortGlyphClasses } from '@/presentation/design/table-default-classes'
import type { SortState } from './sort-state'
import type { ReactElement } from 'react'

/**
 * Sort-direction indicator. `aria-hidden` keeps the accessible name of the
 * columnheader stable (`priority`, not `priority ↑`) so
 * `page.getByRole('columnheader', { name: 'priority' })` still resolves after
 * a sort click. The aria-label sits on the span for spec locators that look up
 * the indicator inside the header. Returns `undefined` when unsorted.
 */
function SortIndicator({ sorted }: { readonly sorted: SortState }): ReactElement | undefined {
  if (sorted === 'asc') {
    return (
      <span
        aria-label="sorted ascending"
        aria-hidden="true"
        className={`sort-asc ${computeTableSortGlyphClasses({ active: true })}`}
      >
        ↑
      </span>
    )
  }
  if (sorted === 'desc') {
    return (
      <span
        aria-label="sorted descending"
        aria-hidden="true"
        className={`sort-desc ${computeTableSortGlyphClasses({ active: true })}`}
      >
        ↓
      </span>
    )
  }
  return undefined
}

/**
 * The glyph a SORTABLE column always shows: its direction once sorted, and the
 * double arrow at rest.
 *
 * The resting glyph is new, and it is the affordance rather than decoration —
 * the sort control has to have a box for a pointer to reach and for a reader to
 * see, and `SortIndicator` draws nothing until a sort exists. `active: false`
 * is the tone the design system already minted for exactly this: "it exists so
 * a caller that DOES draw an inactive affordance has the disabled tone to hand
 * rather than minting one" (`table-shell-default-classes.ts`).
 *
 * `aria-hidden`, like its sorted siblings — the button around it is what
 * carries a name.
 */
export function SortGlyph({ sorted }: { readonly sorted: SortState }): ReactElement {
  return (
    SortIndicator({ sorted }) ?? (
      <span
        aria-hidden="true"
        className={computeTableSortGlyphClasses({ active: false })}
      >
        ↕
      </span>
    )
  )
}
