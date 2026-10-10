/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The checkbox literal reader: how a value written in config, sent in a query
 * string or answered by a database driver is read as a yes-or-no value.
 *
 * Kept free of any `effect` import on purpose. The record-value formatter that
 * the list, kanban, data-table and record-drawer islands share depends on it,
 * so whatever this module imports is shipped to the browser with them.
 */

/** The field types whose value is yes or no (`boolean` and `bool` are the checkbox's aliases). */
export const CHECKBOX_FIELD_TYPES: ReadonlySet<string> = new Set(['checkbox', 'boolean', 'bool'])
const TICKED: ReadonlySet<unknown> = new Set([true, 1, BigInt(1), 'true', '1', 't'])
const UNTICKED: ReadonlySet<unknown> = new Set([false, 0, BigInt(0), 'false', '0', 'f'])

/**
 * A literal or a stored value read as a checkbox — THE one reading, shared by
 * the filters, the gates, the stored-row reader and the record text: `true`,
 * `1` and `'true'` are ticked, `false`, `0` and `'false'` unticked — the
 * spellings an author writes and the drivers answer (SQLite stores `1`/`0`,
 * possibly as a `bigint`, PostgreSQL a real boolean, and `'t'`/`'f'` is its
 * text form). A text is read trimmed and in any case. Anything else is no
 * checkbox value at all.
 */
export const checkboxLiteralOf = (value: unknown): boolean | undefined => {
  const spelled = typeof value === 'string' ? value.trim().toLowerCase() : value
  if (TICKED.has(spelled)) return true
  return UNTICKED.has(spelled) ? false : undefined
}

/**
 * A value compared with a field, read through the field's type — THE one
 * coercion a `dataSource.filter` literal and a `visibility.record` gate share.
 * On a checkbox it is a boolean on both engines, so `eq: 1` and `eq: true`
 * mean the same thing and a PostgreSQL boolean column is never compared with an
 * integer; a list (`in` / `notIn`) is read entry by entry. Every other type,
 * and a value that is no checkbox spelling, is returned as it is.
 */
export const fieldLiteralOf = (fieldType: string | undefined, value: unknown): unknown => {
  if (fieldType === undefined || !CHECKBOX_FIELD_TYPES.has(fieldType)) return value
  if (Array.isArray(value)) return value.map((entry) => checkboxLiteralOf(entry) ?? entry)
  return checkboxLiteralOf(value) ?? value
}

/**
 * A filter's literals read through the type of the field each entry names
 * ({@link fieldLiteralOf}), so a checkbox compared with `1` binds `true`. An
 * absent filter is an empty one; a field the table does not declare is left
 * as written.
 */
export const filterWithFieldLiterals = <
  F extends { readonly field: string; readonly value?: unknown },
>(
  filter: readonly F[] | undefined,
  fields: readonly { readonly name: string; readonly type?: string }[] | undefined
): readonly F[] =>
  (filter ?? []).map((entry) => {
    const type = fields?.find((field) => field.name === entry.field)?.type
    const value = fieldLiteralOf(type, entry.value)
    return value === entry.value ? entry : { ...entry, value }
  })
