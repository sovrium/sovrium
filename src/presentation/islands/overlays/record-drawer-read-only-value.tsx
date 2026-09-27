/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The value a read-only drawer entry prints, drawn the way the grid draws the
 * same field: a `multi-select` or `array` value as one chip per entry, an
 * amount in its column's currency and the page language. Every other value
 * keeps its plain text.
 *
 * The chips share the grid cell's class recipes and its list decoding
 * (`readsAsList`), so a value reads the same in the cell and in the drawer.
 */

import {
  formatCurrencyValue,
  type CurrencyDisplayOptions,
} from '@/domain/kernel/format/currency-format'
import {
  computeArrayChipClasses,
  computeArrayChipsWrapClasses,
} from '@/presentation/design/cell-affordances-default-classes'
import { readsAsList } from '../runtime/cell-value-semantics'
import { resolvePageLocale } from '../runtime/page-locale'
import type { ReactNode } from 'react'

/** Field types whose value is a list of entries, drawn as chips. */
const LIST_FIELD_TYPES: ReadonlySet<string> = new Set(['multi-select', 'array'])

/** Coerce a record value to its read-only display string. */
const toReadOnlyText = (value: unknown): string =>
  value === null || value === undefined ? '' : String(value)

/** An amount as a finite number, or `undefined` when the value holds none. */
const toAmount = (value: unknown): number | undefined => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value !== 'string' || value.trim() === '') return undefined
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : undefined
}

export function ReadOnlyValue({
  type,
  value,
  currency,
}: {
  readonly type: string
  readonly value: unknown
  readonly currency?: CurrencyDisplayOptions | undefined
}): ReactNode {
  if (LIST_FIELD_TYPES.has(type) && value !== null && value !== undefined) {
    const items = readsAsList(value)
    if (items.length === 0) return ''
    return (
      <span className={computeArrayChipsWrapClasses()}>
        {items.map((item, index) => (
          <span
            key={`chip-${String(index)}`}
            className={computeArrayChipClasses()}
          >
            {item}
          </span>
        ))}
      </span>
    )
  }
  const amount = currency === undefined ? undefined : toAmount(value)
  if (currency !== undefined && amount !== undefined) {
    return formatCurrencyValue(amount, currency, resolvePageLocale())
  }
  return toReadOnlyText(value)
}
