/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A `json` column read the way the records API reads it.
 *
 * PostgreSQL stores a `json` field as `JSONB` and its driver hands back the
 * structure; SQLite stores the same value as TEXT and hands back that text. A
 * row read straight from the driver for a page — the record a page or a
 * component is bound to — must give both engines the same value, or a `repeat`
 * over a json list draws its copies on one engine and none on the other.
 *
 * Only a string in a `json` column is decoded; a value that is not valid JSON
 * stays the string it was, and every other column passes unchanged.
 */

/** The part of a table this reads: each field's name and type. */
export interface StoredJsonTable {
  readonly fields: readonly { readonly name: string; readonly type: string }[]
}

const decoded = (value: string): unknown => {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return value
  }
}

/** `row` with every TEXT-stored `json` column of `table` decoded to its structure. */
export const decodeStoredJsonColumns = (
  table: StoredJsonTable | undefined,
  row: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> => {
  const jsonColumns = new Set(
    (table?.fields ?? []).filter((field) => field.type === 'json').map((field) => field.name)
  )
  const textColumns = Object.keys(row).filter(
    (column) => jsonColumns.has(column) && typeof row[column] === 'string'
  )
  if (textColumns.length === 0) return row
  return {
    ...row,
    ...Object.fromEntries(textColumns.map((column) => [column, decoded(row[column] as string)])),
  }
}
