/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Canonical write-path membership rule for the one-of columns — `single-select`
 * and `status` — "the stored value is one the column declares".
 *
 * Both engines carry a member CHECK on these columns (`check_<col>_enum`, built
 * by `generateEnumCheckConstraint`), so an undeclared value never persisted.
 * What it did instead was reach the INSERT, fail there, and come back from the
 * driver seam as a 400 naming no column, after being logged as a server error.
 * Running the rule before the write answers the same field-scoped 422 the
 * `multi-select` membership rule ({@link findUndeclaredMultiSelectValues})
 * answers, and keeps a caller's typo out of the operator's error log.
 *
 * Callers own their own error envelope and copy; this module reports WHICH
 * columns were violated and by what, never how to phrase it.
 */

import { optionValue } from '@/domain/models/app/tables/select-option'
import type { SelectOptionLike } from '@/domain/models/app/tables/select-option'

/** Minimal structural shape this module needs from a table's field list. */
type FieldDeclaration = {
  readonly name: string
  readonly type: string
}

/** One `single-select` or `status` column carrying a value it does not declare. */
export type UndeclaredSingleSelectValue = {
  readonly field: string
  /** The supplied value, stringified. */
  readonly invalid: string
  /** Every option VALUE the column declares (never a display label). */
  readonly allowed: readonly string[]
}

/** The field types whose value must be exactly one declared option. */
const ONE_OF_FIELD_TYPES: ReadonlySet<string> = new Set(['single-select', 'status'])

/**
 * Every option VALUE a column declares, normalised through {@link optionValue}
 * so the `{ value, label }` and `{ value, color }` forms compare on their
 * stored VALUE. A label is display text, never data.
 */
const declaredOptionValues = (field: FieldDeclaration): readonly string[] => {
  if (!('options' in field) || !Array.isArray(field.options)) return []
  return (field.options as readonly SelectOptionLike[]).map(optionValue)
}

/**
 * Every `single-select` / `status` column in `values` whose supplied value is
 * not a declared option, in table field-declaration order.
 *
 * Only columns PRESENT in `values` are inspected, so a partial update of an
 * unrelated column never trips over a legacy value. `undefined` and `null` are
 * not checked: clearing an optional column is legitimate, and emptiness is the
 * `required` rule's concern. A non-string value is stringified rather than
 * skipped — it is not a declared option, and the column CHECK would refuse it.
 */
export const findUndeclaredSingleSelectValues = (
  tableFields: readonly FieldDeclaration[],
  values: Readonly<Record<string, unknown>>
): readonly UndeclaredSingleSelectValue[] =>
  tableFields.flatMap((field) => {
    if (!ONE_OF_FIELD_TYPES.has(field.type) || !(field.name in values)) return []
    const value = values[field.name]
    if (value === undefined || value === null) return []
    const supplied = typeof value === 'string' ? value : String(value)
    const allowed = declaredOptionValues(field)
    return allowed.includes(supplied) ? [] : [{ field: field.name, invalid: supplied, allowed }]
  })
