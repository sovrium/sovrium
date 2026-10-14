/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback } from 'react'
import {
  FILTER_BAR_CONDITION_CLASSES,
  FILTER_BAR_REMOVE_CLASSES,
  FILTER_BAR_SEPARATOR_CLASSES,
  FILTER_BAR_VALUE_CLASSES,
} from '@/presentation/design/filter-bar-default-classes'
import {
  displayValue,
  kindOf,
  labelOf,
  operatorLabel,
} from '@/presentation/design/filter-expression'
import type { FilterBarCondition, FilterBarField } from '@/presentation/design/filter-expression'
import type { ReactElement } from 'react'

interface FilterChipProps {
  readonly index: number
  readonly condition: FilterBarCondition
  readonly field: FilterBarField | undefined
  readonly onRemove: (index: number) => void
}

/** lucide's `x`, the remove glyph. */
const REMOVE_GLYPH = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
)

/**
 * One applied condition, drawn as shadcn/ui's faceted filter: the field's
 * label, a separator, the operator and value in a `secondary` badge, and a
 * ghost button that lifts it.
 *
 * It reads the field's `label` and — for a `select` — the chosen option's
 * `label`, never the column name or the stored token: `Status is Paid`
 * describes what the reader asked for, `status is paid` the database.
 *
 * It always carries its own remove control, including under `allowAdd: false`.
 * A condition a reader can see and cannot lift is a dead end.
 */
export function FilterChip({ index, condition, field, onRemove }: FilterChipProps): ReactElement {
  const handleRemove = useCallback(() => onRemove(index), [index, onRemove])
  const fieldLabel = labelOf(field, condition.field)
  const operatorText = operatorLabel(condition.operator, kindOf(field))
  const valueLabel = displayValue(field, condition.value)
  return (
    <span
      data-filter-chip
      data-slot="filter-bar-condition"
      className={FILTER_BAR_CONDITION_CLASSES}
    >
      {fieldLabel}
      <span
        role="none"
        data-slot="separator"
        data-orientation="vertical"
        className={FILTER_BAR_SEPARATOR_CLASSES}
      />
      <span
        data-slot="badge"
        data-variant="secondary"
        className={FILTER_BAR_VALUE_CLASSES}
      >
        {operatorText} {valueLabel}
      </span>
      <button
        type="button"
        onClick={handleRemove}
        aria-label={`Remove ${fieldLabel} filter`}
        data-slot="button"
        data-variant="ghost"
        data-size="icon-xs"
        className={FILTER_BAR_REMOVE_CLASSES}
      >
        {REMOVE_GLYPH}
      </button>
    </span>
  )
}
