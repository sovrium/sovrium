/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeTableCheckboxControlClasses } from '@/presentation/design/table-default-classes'
import { RatingScale } from '../../parts/rating-scale'
import { readsAsTrue } from '../../runtime/cell-value-semantics'
import type { FieldMeta, FieldWriteValue } from '../../hooks/use-inline-editing'
import type { ReactElement } from 'react'

/**
 * The two controls that commit on ONE click, with no editor to open first.
 *
 * A checkbox and a rating are single-gesture edits. Requiring a double-click to
 * open and then a click to act is two gestures to change one bit, and it is not
 * what either control looks like it wants. So they are rendered by the READ
 * path — the cell shows the live control instead of a picture of its value —
 * and there is no editing state around them at all.
 *
 * That is only safe because the row-click guard now keys on the same condition
 * that makes a row clickable (`hasRowAction || selectionMode === 'single'`)
 * rather than on the row action alone. Before that widening, ticking a checkbox
 * in a single-selection grid would also have selected its row.
 */

export function CheckboxCellControl({
  value,
  label,
  commit,
}: {
  readonly value: unknown
  readonly label: string
  readonly commit: (next: FieldWriteValue) => void
}): ReactElement {
  const checked = readsAsTrue(value)
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      onChange={() => commit(!checked)}
      className={computeTableCheckboxControlClasses({ interactive: true })}
    />
  )
}

/**
 * The rating scale, rendered live in the cell. The control itself is the shared
 * {@link RatingScale}, which the form draws for the same column; the cell only
 * supplies the scale and glyph the column declares.
 */
export function RatingCellControl({
  value,
  label,
  fieldMeta,
  commit,
}: {
  readonly value: unknown
  readonly label: string
  readonly fieldMeta: FieldMeta | undefined
  readonly commit: (next: FieldWriteValue) => void
}): ReactElement {
  return (
    <RatingScale
      value={value}
      label={label}
      commit={commit}
      {...(fieldMeta?.display?.max !== undefined && { max: fieldMeta.display.max })}
      {...(fieldMeta?.display?.style !== undefined && { style: fieldMeta.display.style })}
    />
  )
}
