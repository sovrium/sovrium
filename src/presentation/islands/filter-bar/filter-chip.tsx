/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback } from 'react'
import {
  displayValue,
  kindOf,
  labelOf,
  operatorLabel,
} from '@/presentation/design/filter-expression'
import {
  computeTableChipClasses,
  computeTableChipValueClasses,
} from '@/presentation/design/table-default-classes'
import type { FilterBarCondition, FilterBarField } from '@/presentation/design/filter-expression'
import type { ReactElement } from 'react'

interface FilterChipProps {
  readonly index: number
  readonly condition: FilterBarCondition
  readonly field: FilterBarField | undefined
  readonly onRemove: (index: number) => void
}

/**
 * One applied condition, in the words the author declared.
 *
 * The chip reads the field's `label` and — for a `select` — the chosen option's
 * `label`, never the column name or the stored token. That is the whole reason
 * `fields[]` carries captions at all: a bar is a control a reader operates, and
 * `status is paid` describes the database where `Status is Paid` describes what
 * they asked for.
 *
 * It always carries its own remove control, including under `allowAdd: false`.
 * A condition a reader can see and cannot lift is a dead end — the page arrives
 * narrowed by something they did not choose and cannot undo.
 */
export function FilterChip({ index, condition, field, onRemove }: FilterChipProps): ReactElement {
  const handleRemove = useCallback(() => onRemove(index), [index, onRemove])
  const fieldLabel = labelOf(field, condition.field)
  const operatorText = operatorLabel(condition.operator, kindOf(field))
  const valueLabel = displayValue(field, condition.value)
  return (
    <span
      data-filter-chip
      // The SAME chip the grid's filter and sort panels draw. This component
      // shipped its own literal for the identical vocabulary — a well on a
      // raised surface, where the shared recipe lifts the chip ONTO the surface
      // — so the two drifted a tone and a radius apart.
      className={computeTableChipClasses()}
    >
      <span>
        {fieldLabel} {operatorText}{' '}
        <span className={computeTableChipValueClasses()}>{valueLabel}</span>
      </span>
      <button
        type="button"
        onClick={handleRemove}
        aria-label={`Remove ${fieldLabel} filter`}
        className="text-foreground-muted hover:text-foreground rounded px-1"
      >
        ×
      </button>
    </span>
  )
}
