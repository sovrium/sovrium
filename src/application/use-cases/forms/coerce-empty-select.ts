/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Map the empty string to `null` for every column that is not free text.
 *
 * A form expresses "no answer" as the empty string: an untouched `<select>`
 * posts its leading `<option value="">`, an untouched number or date input
 * posts `""`. The empty string is not a value a typed column can hold — a
 * `single-select` / `status` column's CHECK refuses it, a relationship or a
 * `user` column's foreign key refuses it, PostgreSQL refuses to read it as a
 * number or a date, and SQLite silently STORES it in a number or date column,
 * where every later read sees a string where a value or nothing was expected.
 *
 * "No answer" has exactly one representation, and it is `null` — not `''`,
 * and not the column's first option.
 *
 * An `email`, `url` or `phone-number` column is typed text: an empty answer
 * there is no address at all, so it stores `null` like any other typed column.
 *
 * Free-text columns keep what the visitor typed, empty included: an empty
 * text input stores a genuine empty string, which several shipped behaviours
 * rely on, and there is no constraint for it to violate — except a `unique`
 * one. On a unique column the empty string is itself a value the rule reserves
 * for the first visitor who leaves it blank, so the second would be refused
 * for an answer neither gave; there, too, "no answer" is `null`. The same holds
 * for a `barcode` that declares a `format`: its CHECK refuses the blank.
 *
 * Runs BEFORE `coerceScalarsForArrayColumns` in the pre-INSERT chain: this
 * turns a `multi-select`'s `''` into `null`, and the array coercion then
 * passes `null` through untouched rather than wrapping it into `['']`, which
 * the column's CHECK constraint would reject.
 */

import type { App } from '@/domain/models/app'

/**
 * Column types that store free text, where an empty answer is a genuine empty
 * string. Every other column type stores `null` for "no answer".
 */
const FREE_TEXT_COLUMN_TYPES: ReadonlySet<string> = new Set([
  'single-line-text',
  'long-text',
  'rich-text',
  'code',
  'barcode',
])

/**
 * Loose shape of a table field — kept structural so this helper does not have
 * to depend on the heavily-branded `TableField` discriminated union. Mirrors
 * the sibling `coerce-array-columns.ts`.
 */
interface TableFieldShape {
  readonly name: string
  readonly type: string
  readonly unique?: boolean
  readonly format?: unknown
}

/**
 * A free-text column that nonetheless refuses the empty string: a `unique`
 * one (the blank would be reserved for the first visitor who left it), and a
 * `barcode` declaring a `format`, whose CHECK constraint no empty value passes.
 */
const refusesEmptyText = (field: TableFieldShape): boolean =>
  field.unique === true || (field.type === 'barcode' && typeof field.format === 'string')

/**
 * Names of the columns on `tableName` that cannot hold the empty string. Empty
 * set when the table is unknown or declares none — the caller then
 * short-circuits.
 */
const collectTypedColumnNames = (app: Readonly<App>, tableName: string): ReadonlySet<string> => {
  const table = app.tables?.find((t) => t.name === tableName)
  if (table === undefined) return new Set()
  const fields = (table.fields ?? []) as ReadonlyArray<TableFieldShape>
  return new Set(
    fields
      .filter((field) => !FREE_TEXT_COLUMN_TYPES.has(field.type) || refusesEmptyText(field))
      .map((field) => field.name)
  )
}

/**
 * Replace `''` with `null` for every column that is not free text. Pass-through for
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
  const typedColumns = collectTypedColumnNames(app, tableName)
  if (typedColumns.size === 0) return { ...fields }
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]): readonly [string, unknown] => {
      if (!typedColumns.has(key)) return [key, value]
      if (value === '') return [key, null]
      return [key, value]
    })
  )
}
