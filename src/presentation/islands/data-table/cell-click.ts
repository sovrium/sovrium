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
