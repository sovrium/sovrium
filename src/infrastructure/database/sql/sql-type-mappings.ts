/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveArrayItemSqlType } from '@/domain/models/app/tables/fields/field-types/advanced/array-item-type'
import { parseDatabaseDialectConfig } from '@/domain/models/env/database/database-dialect'
import type { Fields } from '@/domain/models/app/tables/fields'

/**
 * Field type to PostgreSQL type mapping
 * Note: button field type is included for type safety but should not create database columns
 */
export const fieldTypeToPostgresMap: Record<string, string> = {
  'ai-categorize': 'VARCHAR(255)',
  'ai-extract': 'JSONB',
  'ai-generate': 'TEXT',
  'ai-sentiment': 'JSONB',
  'ai-summary': 'TEXT',
  'ai-tag': 'JSONB',
  'ai-translate': 'TEXT',
  integer: 'INTEGER',
  autonumber: 'INTEGER',
  decimal: 'DECIMAL',
  'single-line-text': 'VARCHAR(255)',
  'long-text': 'TEXT',
  email: 'VARCHAR(255)',
  url: 'VARCHAR(255)',
  'phone-number': 'VARCHAR(255)',
  'rich-text': 'TEXT',
  checkbox: 'BOOLEAN',
  boolean: 'BOOLEAN', // Alias for checkbox (used in tests)
  number: 'DECIMAL', // Alias for generic numeric type (used in tests)
  attachment: 'JSONB', // Alias for single-attachment with JSON storage (used in tests)
  date: 'DATE',
  datetime: 'TIMESTAMPTZ',
  time: 'TIME',
  'single-select': 'VARCHAR(255)',
  status: 'VARCHAR(255)',
  'multi-select': 'TEXT[]',
  currency: 'DECIMAL',
  percentage: 'DECIMAL',
  rating: 'INTEGER',
  duration: 'INTERVAL',
  color: 'VARCHAR(7)',
  progress: 'INTEGER',
  json: 'JSONB',
  geolocation: 'POINT',
  barcode: 'VARCHAR(255)',
  'single-attachment': 'VARCHAR(255)',
  'multiple-attachments': 'JSONB',
  relationship: 'INTEGER',
  lookup: 'TEXT',
  rollup: 'TEXT',
  count: 'INTEGER',
  formula: 'TEXT',
  user: 'TEXT',
  'created-by': 'TEXT',
  'updated-by': 'TEXT',
  'deleted-by': 'TEXT',
  // `created_at` / `updated_at` / `deleted_at` record WHEN something happened —
  // an instant. `TIMESTAMP` (without zone) cannot represent one; it is a
  // wall-clock reading whose meaning depends on out-of-band knowledge of the
  // zone. The two other emission sites for these same columns (the intrinsic
  // column generator and the ALTER-TABLE backfill) already emit `TIMESTAMPTZ`,
  // so declaring the field explicitly used to be the one act that downgraded it.
  'created-at': 'TIMESTAMPTZ',
  'updated-at': 'TIMESTAMPTZ',
  'deleted-at': 'TIMESTAMPTZ',
  button: 'TEXT',
  code: 'TEXT',
}

/**
 * Map formula resultType to PostgreSQL type
 */
const formulaResultTypeMap: Record<string, string> = {
  decimal: 'DECIMAL',
  number: 'DECIMAL',
  numeric: 'DECIMAL',
  integer: 'INTEGER',
  int: 'INTEGER',
  boolean: 'BOOLEAN',
  bool: 'BOOLEAN',
  text: 'TEXT',
  string: 'TEXT',
  'text[]': 'TEXT[]',
  'string[]': 'TEXT[]',
  date: 'DATE',
  datetime: 'TIMESTAMPTZ',
  timestamp: 'TIMESTAMPTZ',
}

export const mapFormulaResultTypeToPostgres = (resultType: string | undefined): string => {
  if (!resultType) return 'TEXT'
  return formulaResultTypeMap[resultType.toLowerCase()] ?? 'TEXT'
}

// ============================================================================
// SQLite type mapping
// ============================================================================

/**
 * Exact PostgreSQL type → SQLite type lookup.
 *
 * SQLite uses a small set of storage classes with type affinity rather than
 * Postgres's rich type system, so several Postgres types collapse onto the
 * same SQLite type:
 *
 *   - `TIMESTAMPTZ` / `TIMESTAMP` / `DATE` / `TIME` → `TEXT`
 *     Sovrium stores timestamps as ISO-8601 strings on SQLite (the
 *     `CURRENT_TIMESTAMP` default produces an ISO-shaped string).
 *   - `JSONB` / `JSON` → `TEXT` — JSON is stored as text; SQLite's `json_*`
 *     functions operate on text.
 *   - `SERIAL` / `BIGSERIAL` → `INTEGER` — auto-increment is handled by the id
 *     column generator via `INTEGER PRIMARY KEY AUTOINCREMENT`; a bare
 *     `SERIAL` field column maps to plain `INTEGER`.
 *   - `INTERVAL` → `INTEGER` — durations are stored as a count of seconds.
 *   - `BOOLEAN` → `INTEGER` — SQLite has no boolean type (0/1).
 *   - `POINT` and other advanced/geometry/Postgres-only types → `TEXT` — a
 *     safe fallback so table creation does not crash; the behavior of these
 *     field types degrades on SQLite (Phase 6).
 */
const postgresToSqliteTypeMap: Record<string, string> = {
  TIMESTAMPTZ: 'TEXT',
  TIMESTAMP: 'TEXT',
  DATE: 'TEXT',
  TIME: 'TEXT',
  JSONB: 'TEXT',
  JSON: 'TEXT',
  SERIAL: 'INTEGER',
  BIGSERIAL: 'INTEGER',
  INTERVAL: 'INTEGER',
  BOOLEAN: 'INTEGER',
  POINT: 'TEXT',
  GEOMETRY: 'TEXT',
  GEOGRAPHY: 'TEXT',
  TSVECTOR: 'TEXT',
  VECTOR: 'TEXT',
  UUID: 'TEXT',
}

/**
 * Translate a PostgreSQL column type (as produced by the maps above) to its
 * SQLite equivalent.
 *
 * Parameterized types are normalized first — `TEXT[]` (and any `…[]` array)
 * becomes `TEXT` (arrays are stored as JSON text), `VARCHAR(n)`/`CHAR(n)`
 * becomes `TEXT` (SQLite ignores the length), and `NUMERIC(p,s)`/`DECIMAL(p,s)`
 * becomes `NUMERIC` affinity — then the exact-match lookup above applies.
 * Anything already SQLite-native (`TEXT`, `INTEGER`, `NUMERIC`, `REAL`) passes
 * through unchanged.
 *
 * @public
 */
export const mapPostgresTypeToSqlite = (postgresType: string): string => {
  const upper = postgresType.toUpperCase().trim()

  // Array types — `TEXT[]`, `INTEGER[]`, etc. — stored as JSON array text.
  if (upper.endsWith('[]')) return 'TEXT'
  // VARCHAR(n) / CHAR(n) — strip the length, map to TEXT affinity.
  if (upper.startsWith('VARCHAR') || upper.startsWith('CHAR')) return 'TEXT'
  // NUMERIC(p,s) / DECIMAL(p,s) — strip precision, map to NUMERIC affinity.
  if (upper.startsWith('NUMERIC') || upper.startsWith('DECIMAL')) return 'NUMERIC'

  // Exact-match lookup; fall through to the already-native type otherwise.
  return postgresToSqliteTypeMap[upper] ?? upper
}

/**
 * Map a field type to the column type for the active database dialect.
 *
 * PostgreSQL is the historical path (`mapFieldTypeToPostgres`); SQLite
 * translates that result through `mapPostgresTypeToSqlite`.
 *
 * @public
 */
export const mapFieldTypeToDialect = (field: Fields[number]): string => {
  const postgresType = mapFieldTypeToPostgres(field)
  return parseDatabaseDialectConfig().dialect === 'sqlite'
    ? mapPostgresTypeToSqlite(postgresType)
    : postgresType
}

/**
 * Map a formula `resultType` to the column type for the active dialect.
 *
 * @public
 */
export const mapFormulaResultTypeToDialect = (resultType: string | undefined): string => {
  const postgresType = mapFormulaResultTypeToPostgres(resultType)
  return parseDatabaseDialectConfig().dialect === 'sqlite'
    ? mapPostgresTypeToSqlite(postgresType)
    : postgresType
}

const NUMERIC_TYPES_WITH_PRECISION = new Set(['decimal', 'currency', 'percentage'])

/**
 * Generous integer-part allowance for `NUMERIC(p,s)` columns.
 *
 * In Sovrium's schema a numeric field's `precision` property means "number of
 * DECIMAL PLACES" (1-10; percentage allows 0) — i.e. the SQL *scale*, NOT the
 * SQL total-digit *precision*. SQL's `NUMERIC(p,s)` declares `p` total digits
 * and `s` digits after the point, so the integer part can hold at most `p - s`
 * digits.
 *
 * The previous mapping emitted `NUMERIC(precision,2)` — it stuffed the
 * decimal-places count into the total-digits slot and hardcoded scale=2. A
 * field with `precision: 2` (meaning "2 decimal places") became `NUMERIC(2,2)`,
 * whose max value is 0.99, so inserting `19.99` failed with a numeric-overflow
 * error on Postgres (issue #15). SQLite hid the bug because NUMERIC(p,s) maps to
 * plain NUMERIC affinity and stores the value verbatim — a cross-dialect
 * divergence.
 *
 * The fix uses `precision` as the SQL scale and adds this fixed integer-part
 * allowance for the total digits: `NUMERIC(NUMERIC_INTEGER_DIGITS + precision,
 * precision)`. 18 integer digits comfortably cover currency and measurement
 * values (up to ~10^18) while keeping the total precision (≤ 28 with max
 * scale 10) far below Postgres's NUMERIC limit of 1000.
 */
const NUMERIC_INTEGER_DIGITS = 18

/**
 * Special-case PostgreSQL type for fields whose mapping isn't a flat lookup
 * (array element type, numeric precision, single-attachment metadata mode).
 * Returns undefined when the field falls through to the canonical type map.
 */
const specialCasePostgresType = (field: Fields[number]): string | undefined => {
  if (field.type === 'array') {
    // `itemType` is authoring vocabulary, not SQL — see `resolveArrayItemSqlType`
    // for why upper-casing it emitted types PostgreSQL does not have. The
    // `?? 'TEXT'` arm is unreachable through a decoded config (the field schema
    // refuses unresolvable spellings); it keeps this generator emitting VALID
    // DDL rather than a broken type should it ever run on raw input.
    const declared = 'itemType' in field ? field.itemType : undefined
    return `${resolveArrayItemSqlType(declared) ?? 'TEXT'}[]`
  }
  if (
    NUMERIC_TYPES_WITH_PRECISION.has(field.type) &&
    'precision' in field &&
    field.precision !== undefined
  ) {
    // `precision` is the SQL scale (decimal places); allow a generous integer
    // part so values like 19.99 (precision: 2) fit. precision: 0 → NUMERIC(18,0).
    return `NUMERIC(${NUMERIC_INTEGER_DIGITS + field.precision},${field.precision})`
  }
  // single-attachment with storeMetadata: true uses JSONB for metadata objects.
  if (
    field.type === 'single-attachment' &&
    'storeMetadata' in field &&
    field.storeMetadata === true
  ) {
    return 'JSONB'
  }
  return undefined
}

/**
 * Map field type to PostgreSQL column type
 * Throws error if field type is not recognized
 */
export const mapFieldTypeToPostgres = (field: Fields[number]): string => {
  const special = specialCasePostgresType(field)
  if (special !== undefined) return special
  const postgresType = fieldTypeToPostgresMap[field.type]
  if (!postgresType) {
    // eslint-disable-next-line functional/no-throw-statements -- Error is caught by Effect.try in table-operations.ts
    throw new Error(`Unknown field type: ${field.type}`)
  }
  return postgresType
}
