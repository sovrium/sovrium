/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Map the empty string to `null` for option-constrained columns.
 *
 * A `<select>` expresses "no answer" with a leading `<option value="">`, so an
 * untouched optional select form-encodes as `role=` and arrives here as the
 * empty string. `''` is not one of the column's declared options: a
 * `single-select` / `multi-select` column carries a CHECK constraint over its
 * option values, so an un-coerced `''` is REJECTED by the database and the
 * whole submission fails — the visitor is blocked on a field they were never
 * obliged to answer.
 *
 * "No answer" has exactly one representation, and it is `null`. Not `''`, and
 * not the column's first option (which is what the browser stored before the
 * leading empty option existed, silently recording an answer nobody gave).
 *
 * Deliberately scoped to option-constrained columns ONLY. Coercing `''` to
 * `null` everywhere would change what an empty text input stores — today a
 * genuine empty string, which several shipped behaviours rely on — and that
 * is a different decision with a different blast radius. Free-text columns
 * have no constraint to violate, so they need no coercion.
 *
 * Runs BEFORE `coerceScalarsForArrayColumns` in the pre-INSERT chain: this
 * turns a `multi-select`'s `''` into `null`, and the array coercion then
 * passes `null` through untouched rather than wrapping it into `['']`, which
 * the same CHECK constraint would reject.
 */

import type { App } from '@/domain/models/app'

/**
 * Column types whose values are constrained to a declared `options[]` set,
 * and which therefore cannot store the empty string.
 */
const OPTION_CONSTRAINED_COLUMN_TYPES: ReadonlySet<string> = new Set([
  'single-select',
  'multi-select',
])

/**
 * Loose shape of a table field — kept structural so this helper does not have
 * to depend on the heavily-branded `TableField` discriminated union. Mirrors
 * the sibling `coerce-array-columns.ts`.
 */
interface TableFieldShape {
  readonly name: string
  readonly type: string
}

/**
 * Names of the option-constrained columns on `tableName`. Empty set when the
 * table is unknown or declares none — the caller then short-circuits.
 */
const collectOptionConstrainedColumnNames = (
  app: Readonly<App>,
  tableName: string
): ReadonlySet<string> => {
  const table = app.tables?.find((t) => t.name === tableName)
  if (table === undefined) return new Set()
  const fields = (table.fields ?? []) as ReadonlyArray<TableFieldShape>
  return new Set(
    fields
      .filter((field) => OPTION_CONSTRAINED_COLUMN_TYPES.has(field.type))
      .map((field) => field.name)
  )
}

/**
 * Replace `''` with `null` for option-constrained columns. Pass-through for
 * every other column, for non-empty values, and for values that are already
 * `null` / `undefined` / an array.
 *
 * Pure and synchronous so it composes into the existing pre-INSERT filter
 * chain in `submit-form.ts::writeBoundTableRecord`.
 */
export const coerceEmptySelectToNull = (
  fields: Readonly<Record<string, unknown>>,
  app: Readonly<App>,
  tableName: string
): Readonly<Record<string, unknown>> => {
  const optionColumns = collectOptionConstrainedColumnNames(app, tableName)
  if (optionColumns.size === 0) return { ...fields }
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]): readonly [string, unknown] => {
      if (!optionColumns.has(key)) return [key, value]
      // eslint-disable-next-line unicorn/no-null -- SQL NULL is the target value, not "absent": `undefined` is dropped from the INSERT, which would fall back to the column default rather than storing "no answer"
      if (value === '') return [key, null]
      return [key, value]
    })
  )
}
