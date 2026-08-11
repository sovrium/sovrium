/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { mapFieldTypeToPostgres } from '../sql/sql-generators'
import type { Fields } from '@/domain/models/app/tables/fields'

/**
 * Canonical form of a timestamp type, keeping the zone-aware and zone-naive
 * variants APART.
 *
 * PostgreSQL spells the same two types several ways: `TIMESTAMPTZ` (the DDL
 * shorthand this codebase emits) and `timestamp with time zone` /
 * `timestamp without time zone` (what `information_schema.columns` reports),
 * each optionally carrying a `(p)` precision.
 *
 * Collapsing all of them onto `'timestamp'` — as this function's caller did
 * until the columns were unified — made `doesColumnTypeMatch` report equality
 * across the two, so no migration ever fired between them and a database could
 * silently hold both forms of the same logical column forever.
 *
 * Note the substring test order is not load-bearing: `'without time zone'` is
 * checked first, and `'with time zone'` is NOT a substring of
 * `'without time zone'` ("with" is followed by "out"), so either order agrees.
 * It is checked first for the reader, not the parser.
 */
const normalizeTimestampType = (normalized: string): string => {
  if (normalized.startsWith('timestamptz')) return 'timestamptz'
  if (normalized.includes('without time zone')) return 'timestamp'
  if (normalized.includes('with time zone')) return 'timestamptz'
  return 'timestamp'
}

/**
 * Normalize PostgreSQL data type for comparison
 * Maps similar types to a canonical form (e.g., 'varchar' and 'character varying' both map to 'varchar')
 * Strips length specifiers and precision for type matching
 */
export const normalizeDataType = (dataType: string): string => {
  const normalized = dataType.toLowerCase().trim()

  // Map 'character varying' to 'varchar' for easier comparison
  if (normalized.startsWith('character varying')) return 'varchar'
  if (normalized.startsWith('timestamp')) return normalizeTimestampType(normalized)
  if (normalized.startsWith('numeric') || normalized.startsWith('decimal')) return 'numeric'

  // Map PostgreSQL ARRAY type to text[] for comparison with field type mappings
  // information_schema.columns returns 'ARRAY' for all array columns
  if (normalized === 'array') return 'text[]'

  // Strip length specifiers for varchar, char, etc.
  // varchar(255) → varchar, char(10) → char, numeric(10,2) → numeric
  const withoutLength = normalized.replace(/\([^)]*\)/, '')

  return withoutLength
}

/**
 * Check if column data type matches the expected type from schema
 */
export const doesColumnTypeMatch = (field: Fields[number], existingDataType: string): boolean => {
  const expectedType = mapFieldTypeToPostgres(field)
  const normalizedExpected = normalizeDataType(expectedType)
  const normalizedExisting = normalizeDataType(existingDataType)

  // For varchar/text types, check if both are string types
  if (
    (normalizedExpected === 'varchar' || normalizedExpected === 'text') &&
    (normalizedExisting === 'varchar' || normalizedExisting === 'text')
  ) {
    // Match if both are string types (varchar/text are interchangeable for our purposes)
    return normalizedExpected === normalizedExisting
  }

  // For other types, exact match required
  return normalizedExpected === normalizedExisting
}

/** Timestamp targets a TEXT column must be cast into explicitly. */
const TEXT_CASTABLE_TIMESTAMP_TARGETS: ReadonlySet<string> = new Set(['timestamp', 'timestamptz'])

/**
 * The `USING …` clause a given conversion needs, or `''` when PostgreSQL can
 * cast automatically.
 *
 * @param columnName - the physical column being reshaped
 * @param targetType - the raw target type, needed for the `VARCHAR(n)` length
 * @param normalizedExisting - canonical form of the live column type
 * @param normalizedTarget - canonical form of `targetType`
 */
const resolveUsingClause = (
  columnName: string,
  targetType: string,
  normalizedExisting: string,
  normalizedTarget: string
): string => {
  // TEXT → VARCHAR requires LEFT() to truncate
  if (normalizedExisting === 'text' && normalizedTarget === 'varchar') {
    const lengthMatch = targetType.match(/VARCHAR\((\d+)\)/)
    const length = lengthMatch ? lengthMatch[1] : '255'
    return ` USING LEFT(${columnName}, ${length})`
  }

  // TEXT → INTEGER requires explicit cast
  if (normalizedExisting === 'text' && normalizedTarget === 'integer') {
    return ` USING ${columnName}::INTEGER`
  }

  // TEXT → TIMESTAMP / TIMESTAMPTZ requires an explicit cast, since PostgreSQL
  // refuses to cast text to a timestamp automatically ("column cannot be cast
  // automatically") and would fail the boot.
  //
  // The `timestamptz` arm is LOAD-BEARING and easy to lose: this branch used to
  // test `normalizedTarget === 'timestamp'` alone and still fired for a
  // TIMESTAMPTZ target, purely because `normalizeDataType` collapsed the two.
  // Now that they normalize apart, the target set must name both explicitly.
  if (normalizedExisting === 'text' && TEXT_CASTABLE_TIMESTAMP_TARGETS.has(normalizedTarget)) {
    return ` USING ${columnName}::TIMESTAMPTZ`
  }

  // TIMESTAMP → TIMESTAMPTZ: the DEFAULT cast, with NO `USING` clause. The
  // ABSENCE is deliberate — do not "fix" it by adding one.
  //
  // The default cast interprets the naive stored value in the session
  // `TimeZone`, which is the exact inverse of the write that produced it
  // (`CURRENT_TIMESTAMP` is a `timestamptz` implicitly cast DOWN through that
  // same GUC), so the instant is preserved on any server whose `TimeZone` has
  // been constant — UTC or not.
  //
  // `USING <col> AT TIME ZONE 'UTC'` is strictly dominated and must NEVER be
  // used here: it ASSERTS the naive values were UTC. Measured on a
  // `Europe/Paris` server: default cast → 0 s shift; `AT TIME ZONE 'UTC'` →
  // 7200 s shift on every row. On a UTC server the two are identical, so a
  // UTC-only test cannot tell them apart.
  if (normalizedExisting === 'timestamp' && normalizedTarget === 'timestamptz') {
    return ''
  }

  // INTEGER → NUMERIC conversion (automatic, no USING clause needed)
  // PostgreSQL can implicitly convert INTEGER to NUMERIC
  return ''
}

/**
 * Generate ALTER COLUMN TYPE statement with USING clause if needed
 * Handles type conversions that require explicit casting or transformation
 */
export const generateAlterColumnTypeStatement = (
  tableName: string,
  field: Fields[number],
  existingDataType: string
): string => {
  const targetType = mapFieldTypeToPostgres(field)
  const usingClause = resolveUsingClause(
    field.name,
    targetType,
    normalizeDataType(existingDataType),
    normalizeDataType(targetType)
  )

  return `ALTER TABLE ${tableName} ALTER COLUMN ${field.name} TYPE ${targetType}${usingClause}`
}

/**
 * Whether reshaping `existingDataType` into this field's type is the gated
 * `timestamp → timestamptz` conversion.
 *
 * That conversion is deliberately NOT owned by the ordinary migration path: it
 * rewrites the whole table under an `ACCESS EXCLUSIVE` lock, and it is only
 * instant-preserving under an assumption about the server's `TimeZone` that the
 * platform cannot verify on its own. It is therefore excluded from
 * `findTypeChanges` and owned end-to-end by the boot-time reconciler, which
 * gates it behind an operator opt-in and a `TimeZone` preflight.
 */
export const isGatedTimestamptzConversion = (
  field: Fields[number],
  existingDataType: string
): boolean =>
  normalizeDataType(existingDataType) === 'timestamp' &&
  normalizeDataType(mapFieldTypeToPostgres(field)) === 'timestamptz'
