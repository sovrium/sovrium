/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Resolve an `array` field's `itemType` to the SQL type of its elements.
 *
 * `itemType` is AUTHORING vocabulary, not SQL. The array field's own `examples`
 * annotation documents `itemType: 'string'`, and that annotation ships inside
 * the generated JSON Schema every config author writes against. The DDL
 * generator nonetheless upper-cased whatever it was handed and appended `[]`,
 * so the documented example asked PostgreSQL for `STRING[]` — a type it does
 * not have. Startup aborted while creating the table, which takes the whole
 * server down: a config following the published example could not boot.
 *
 * Hence a table rather than a bare allowlist. An allowlist alone would refuse
 * `'string'` too, breaking the very example the schema advertises. Friendly
 * aliases resolve to the type they plainly mean, and anything OUTSIDE the table
 * resolves to `undefined` so the schema can refuse it as a config error — named,
 * before any SQL is generated — instead of letting the database discover it.
 *
 * The alias half mirrors `formulaResultTypeMap`, which already answers the same
 * question for a formula's `resultType`. The refusal half is the difference:
 * a formula falls back to `TEXT`, while a silent fallback here would hide the
 * author's typo rather than report it.
 */

/**
 * Supported `itemType` spellings and the PostgreSQL element type each denotes.
 *
 * Lower-cased keys; lookups normalise. Values are PostgreSQL types — the SQLite
 * generator translates `<TYPE>[]` to plain `TEXT` (arrays are stored as JSON
 * text there), so no parallel table is needed.
 */
const ARRAY_ITEM_SQL_TYPES: Readonly<Record<string, string>> = {
  // Text
  text: 'TEXT',
  string: 'TEXT',
  varchar: 'TEXT',
  // Whole numbers
  integer: 'INTEGER',
  int: 'INTEGER',
  bigint: 'BIGINT',
  smallint: 'SMALLINT',
  // Fractional numbers
  decimal: 'DECIMAL',
  numeric: 'DECIMAL',
  number: 'DECIMAL',
  float: 'DOUBLE PRECISION',
  double: 'DOUBLE PRECISION',
  real: 'REAL',
  // Truth values
  boolean: 'BOOLEAN',
  bool: 'BOOLEAN',
  // Time
  date: 'DATE',
  datetime: 'TIMESTAMPTZ',
  timestamp: 'TIMESTAMPTZ',
  time: 'TIME',
  // Structured
  uuid: 'UUID',
  json: 'JSONB',
  jsonb: 'JSONB',
}

/** Every accepted `itemType` spelling, for author-facing error messages. */
export const ARRAY_ITEM_TYPE_NAMES: readonly string[] = Object.keys(ARRAY_ITEM_SQL_TYPES)

/**
 * The PostgreSQL element type for `itemType`, or `undefined` when it names no
 * supported type.
 *
 * An omitted `itemType` means "untyped array" and resolves to `TEXT`, matching
 * the generator's long-standing default.
 */
export const resolveArrayItemSqlType = (itemType: string | undefined): string | undefined => {
  if (itemType === undefined || itemType.trim() === '') return 'TEXT'
  return ARRAY_ITEM_SQL_TYPES[itemType.trim().toLowerCase()]
}

/** Whether `itemType` names an element type the DDL generator can emit. */
export const isSupportedArrayItemType = (itemType: string): boolean =>
  resolveArrayItemSqlType(itemType) !== undefined
