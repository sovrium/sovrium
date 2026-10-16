/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { stopClickPropagation } from '../cell-click'
import { useGridString } from '../island/grid-strings'
import { GridCheckbox } from './grid-checkbox'
import type { ReactElement } from 'react'

type ToggleHandler = (event: unknown) => void

/** The header checkbox, named in the page language (`datatable.selectAll`). */
export function SelectAllCheckbox(props: {
  readonly checked: boolean
  readonly indeterminate: boolean
  readonly onChange: ToggleHandler
}): ReactElement {
  return (
    <GridCheckbox
      interactive
      {...props}
      aria-label={useGridString('datatable.selectAll', 'Select all rows')}
    />
  )
}

/**
 * A row's checkbox, named in the page language (`datatable.selectRow`).
 *
 * The checkbox owns its own click, on the same terms an editable cell does.
 * Without this the click ALSO reaches the row, so on a grid whose rows carry an
 * action — a row-click navigation, or a `rowExpand` — the reader ticking three
 * rows to act on them would open (and re-open) a record panel per tick.
 * Selecting is a gesture about the row, not a gesture on it.
 */
export function SelectRowCheckbox({
  n,
  ...props
}: {
  readonly n: number
  readonly checked: boolean
  readonly disabled: boolean
  readonly onChange: ToggleHandler
}): ReactElement {
  return (
    <GridCheckbox
      interactive
      {...props}
      onClick={stopClickPropagation}
      aria-label={useGridString('datatable.selectRow', 'Select row {n}', { n })}
    />
  )
}
