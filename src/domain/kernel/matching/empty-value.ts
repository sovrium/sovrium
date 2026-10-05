/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A plain object — `{}` literal or `Object.create(null)` — as opposed to a
 * `Date`, a `Map` or any class instance, which carry meaning without own keys.
 */
const isPlainObject = (value: unknown): value is Readonly<Record<string, unknown>> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const proto: unknown = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/**
 * The one rule every surface reads `isEmpty` / `isNotEmpty` by: a value is
 * empty when it is missing (`undefined`), `null`, an empty text (`''`), an
 * empty list (`[]`) or an empty plain object (`{}`).
 *
 * Nothing else is empty. `0`, `false`, a blank space, `{"a": null}` and
 * `[null]` are values: an object with a key and a list with an entry hold
 * something, whatever that something is. The SQL filter compiles the same
 * rule (`NULL` or the text `''`, `'[]'`, `'{}'`), so a record the database
 * lists as empty is the record every in-memory check calls empty.
 */
export const isEmptyValue = (value: unknown): boolean => {
  if (value === undefined || value === null || value === '') return true
  if (Array.isArray(value)) return value.length === 0
  if (isPlainObject(value)) return Object.keys(value).length === 0
  return false
}

/**
 * SQLite has no array or JSON type: a multi-select, a JSON field or a list
 * comes back from a raw row as its JSON TEXT, so an empty one arrives as the
 * text `'[]'` or `'{}'` — where PostgreSQL hands back a real `[]` or `{}`.
 * Read those two spellings back as the empty list and object they encode; any
 * other value passes through untouched.
 */
const decodeEmptyJsonText = (value: unknown): unknown => {
  if (value === '[]') return []
  if (value === '{}') return {}
  return value
}

/**
 * Judge a stored CELL for emptiness exactly as the SQL filter does
 * (`CAST(col AS TEXT) IN ('', '[]', '{}')`): {@link isEmptyValue}, after the
 * texts `'[]'` and `'{}'` are read as the empty list and object they spell.
 *
 * This is the predicate for a record value — a raw row from either engine, or
 * a record from the API. The consequence is deliberate and matches the
 * database: a plain text field literally holding `[]` or `{}` is empty, on
 * every surface that judges a cell. Only the presence test decodes; `eq`,
 * `contains` and the rest compare the cell as stored.
 */
export const isEmptyCell = (value: unknown): boolean => isEmptyValue(decodeEmptyJsonText(value))
