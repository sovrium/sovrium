/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { MouseEvent } from 'react'

/**
 * A click that lands on a control belongs to that CONTROL, not to the row.
 *
 * This is the whole of the grid's click-composition rule, and it lives in its
 * own module because more than one place needs it: an editable cell claims its
 * clicks in `data-row.tsx`, and the selection checkbox claims its own in
 * `island/columns.tsx`. A row can carry several plausible meanings at once —
 * edit, select, expand the record, collapse a group — and they are separated by
 * the TARGET rather than by timing, so each control stopping its own click is
 * the entire mechanism. Two copies of it would be two chances to disagree about
 * which clicks a row owns.
 */
export const stopClickPropagation = (e: MouseEvent): void => e.stopPropagation()

/**
 * Does this click land on a link or a button INSIDE the row, rather than on the
 * row itself? An email cell's `mailto:` link, a phone cell's `tel:` link and a
 * cell's own button each own their click: the row's action must not fire too.
 */
export const clickLandsOnInnerControl = (e: MouseEvent<Element>): boolean => {
  const control = (e.target as Element | null)?.closest?.('a,button')
  return control != null && control !== e.currentTarget && e.currentTarget.contains(control)
}
