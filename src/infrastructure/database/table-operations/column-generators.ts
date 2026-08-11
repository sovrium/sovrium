/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  INTRINSIC_CREATED_AT_COLUMN,
  INTRINSIC_DELETED_AT_COLUMN,
  INTRINSIC_ID_COLUMN,
  INTRINSIC_UPDATED_AT_COLUMN,
} from '@/domain/models/shared/system-fields'
import { SQLITE_ISO_NOW } from '@/infrastructure/database/sql/dialect-ddl'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import type { Table } from '@/domain/models/app/tables'

/**
 * The DB-side timestamp `DEFAULT` clause for the active dialect.
 *
 * - PostgreSQL: `DEFAULT CURRENT_TIMESTAMP` — yields a `timestamptz`.
 * - SQLite: `DEFAULT (strftime(...))` — bare `CURRENT_TIMESTAMP` on SQLite is
 *   not ISO-8601, and the records-API response schema validates timestamps
 *   with `z.string().datetime()`. `strftime` produces a true ISO-8601 string
 *   (see {@link SQLITE_ISO_NOW}). SQLite requires a parenthesised expression
 *   for a non-constant column default.
 */
const timestampDefaultClause = (): string =>
  isSqliteRuntime() ? `DEFAULT (${SQLITE_ISO_NOW})` : 'DEFAULT CURRENT_TIMESTAMP'

/**
 * SQLite UUID DB-side default.
 *
 * SQLite has no `gen_random_uuid()`. `lower(hex(randomblob(16)))` produces a
 * 32-hex-char random string (a UUID's worth of entropy, without the hyphens),
 * so an `INSERT` that omits `id` still gets a unique value — the dynamic CRUD
 * path relies on a DB-side `id` default. The same approach the SQLite schema
 * mirror takes via `crypto.randomUUID()`, expressed as DDL for runtime-created
 * user tables.
 */
const SQLITE_UUID_DEFAULT = 'lower(hex(randomblob(16)))'

/**
 * Generate automatic id column definition based on primary key type.
 *
 *, the default (omitted `primaryKeyType`) and `'bigserial'` cases
 * align to INTEGER on both dialects:
 *   - PostgreSQL: `SERIAL` / `BIGSERIAL` (unchanged)
 *   - SQLite:     `INTEGER PRIMARY KEY AUTOINCREMENT` (must be inline)
 *
 * `'uuid'` and `'text'` opt-ins still produce TEXT/UUID ids on both dialects
 * (recommended for sensitive tables per pre-launch-security S1 anti-enumeration).
 *
 * @param primaryKeyType - Type of primary key (uuid, bigserial, text, or default serial)
 * @param isPrimaryKey - Whether this id column is the primary key (PK is emitted inline)
 *
 * `text` is used for tables declared in `auth.scopeTables` so applications
 * can use portable string IDs (e.g., 'acme', 'globex') in the multi-tenant
 * `user_access.record_ids` column without forcing UUIDs.
 *
 * Dialect notes for `'uuid'` / `'text'`:
 *   - Postgres uses `gen_random_uuid()`; SQLite has no such function, so the
 *     DB-side default is `lower(hex(randomblob(16)))` and the column type is
 *     `TEXT` (SQLite has no `UUID` type).
 *
 * Dialect notes for `'bigserial'` / default `'serial'`:
 *   - Postgres uses `BIGSERIAL` / `SERIAL`.
 *   - SQLite uses `INTEGER PRIMARY KEY AUTOINCREMENT`. The AUTOINCREMENT
 *     contract requires the PK to be declared **inline** on the column —
 *     a separate table-level `PRIMARY KEY (id)` constraint under a bare
 *     `INTEGER` column will not auto-generate values. `create-table-sql.ts`
 *     therefore passes `isPrimaryKey=true` for the default automatic-id
 *     path so the inline form fires, and emits no separate table-level
 *     constraint that would duplicate it.
 */
export const generateIdColumn = (
  primaryKeyType: string | undefined,
  isPrimaryKey: boolean
): string => {
  const pkConstraint = isPrimaryKey ? ' PRIMARY KEY' : ''

  if (isSqliteRuntime()) {
    // Schema-author opt-ins to opaque string ids — TEXT on both dialects.
    if (primaryKeyType === 'uuid' || primaryKeyType === 'text') {
      return `id TEXT NOT NULL DEFAULT (${SQLITE_UUID_DEFAULT})${pkConstraint}`
    }
    // Default-serial / bigserial — [internal ref]. AUTOINCREMENT requires inline PK.
    // When `isPrimaryKey=true`, emit `INTEGER PRIMARY KEY AUTOINCREMENT`
    // (no NOT NULL needed — `INTEGER PRIMARY KEY` is implicitly NOT NULL).
    // When `isPrimaryKey=false`, the caller did not request inline PK and a
    // separate table-level `PRIMARY KEY (id)` constraint will be added; the
    // column itself is still INTEGER so the relationship FK type matches.
    return isPrimaryKey ? `id INTEGER PRIMARY KEY AUTOINCREMENT` : `id INTEGER NOT NULL`
  }

  if (primaryKeyType === 'uuid') {
    return `id UUID NOT NULL DEFAULT gen_random_uuid()${pkConstraint}`
  }
  if (primaryKeyType === 'bigserial') {
    return `id BIGSERIAL NOT NULL${pkConstraint}`
  }
  if (primaryKeyType === 'text') {
    return `id TEXT NOT NULL DEFAULT gen_random_uuid()::text${pkConstraint}`
  }
  return `id SERIAL NOT NULL${pkConstraint}`
}

/**
 * Resolve the SQL column type a foreign key must declare to reference a table's
 * automatic primary-key (`id`) column.
 *
 * This MUST stay aligned with {@link generateIdColumn}'s `id` column type:
 *   - `'text'` / `'uuid'` (explicit, or implicit via `auth.scopeTables` —
 *     `applySchemaDefaults` assigns `{ type: 'text' }`) → the id is TEXT/UUID,
 *     so the FK column is TEXT/UUID.
 *   - `'bigserial'` → the id is `BIGSERIAL` (a BIGINT-backed sequence), so the
 *     FK column is plain `BIGINT` (an FK column never declares the sequence).
 *   - default / omitted → the id is `SERIAL` (an INTEGER-backed sequence), so
 *     the FK column is plain `INTEGER`.
 *
 * On SQLite, `text`/`uuid` ids are TEXT and serial/bigserial ids are INTEGER, so
 * the FK column types collapse accordingly.
 *
 * @param primaryKeyType - the table's `primaryKey.type` (undefined ⇒ default serial)
 * @returns the FK column SQL type that matches the referenced `id` column
 * @public
 */
export const resolvePrimaryKeyColumnType = (primaryKeyType: string | undefined): string => {
  if (primaryKeyType === 'uuid') return isSqliteRuntime() ? 'TEXT' : 'UUID'
  if (primaryKeyType === 'text') return 'TEXT'
  if (primaryKeyType === 'bigserial') return isSqliteRuntime() ? 'INTEGER' : 'BIGINT'
  // default / omitted serial → INTEGER on both dialects.
  return 'INTEGER'
}

/**
 * Determine if table needs an automatic id column
 * Creates automatic id column if:
 * - No explicit id field is defined in the fields array
 * - Either: no primary key is defined OR primary key references the special 'id' field
 */
export const needsAutomaticIdColumn = (
  table: Table,
  primaryKeyFields: readonly string[]
): boolean => {
  const hasIdField = table.fields.some((field) => field.name === INTRINSIC_ID_COLUMN)
  const primaryKeyReferencesId = primaryKeyFields.includes(INTRINSIC_ID_COLUMN)
  const hasNonIdPrimaryKey = primaryKeyFields.length > 0 && !primaryKeyReferencesId
  return !hasIdField && !hasNonIdPrimaryKey
}

/**
 * Timestamp column type for the active dialect — the INTRINSIC path (this file
 * adds `created_at` / `updated_at` / `deleted_at` when the config declares none).
 *
 * Postgres uses `TIMESTAMPTZ`. SQLite has no timezone-aware timestamp type;
 * timestamps are stored as ISO-8601 `TEXT` (the `SQLITE_ISO_NOW` default yields
 * a UTC string with an explicit `Z`), so the column type is `TEXT`.
 *
 * NOTE — a split exists today, and [internal ref] is the decision to close it. When a
 * config author DECLARES a `created-at` / `updated-at` / `deleted-at` field
 * instead of relying on this intrinsic path, the column type comes from
 * `sql/sql-type-mappings.ts:62-64`, which still emits `TIMESTAMP` **without**
 * zone. `normalizeDataType` collapses both forms to `'timestamp'`, so the
 * migration detector cannot see the difference and no ALTER ever fires between
 * them. the declared path moves to `TIMESTAMPTZ`, the detector
 * learns to distinguish the two, and existing columns are converted only behind
 * an explicit operator opt-in with a session-`TimeZone` preflight — because the
 * naive values in an existing `timestamp` column are server-local wall clock,
 * not UTC.
 *
 */
const timestampColumnType = (): string => (isSqliteRuntime() ? 'TEXT' : 'TIMESTAMPTZ')

/**
 * Generate created_at column definition if not explicitly defined
 * Note: Includes DEFAULT CURRENT_TIMESTAMP to support INSERT ... DEFAULT VALUES
 * Triggers also set the value to ensure consistency
 */
export const generateCreatedAtColumn = (table: Table): readonly string[] => {
  const hasCreatedAtField = table.fields.some((field) => field.name === INTRINSIC_CREATED_AT_COLUMN)
  return !hasCreatedAtField
    ? [
        `${INTRINSIC_CREATED_AT_COLUMN} ${timestampColumnType()} NOT NULL ${timestampDefaultClause()}`,
      ]
    : []
}

/**
 * Generate updated_at column definition if not explicitly defined
 * Note: Includes DEFAULT CURRENT_TIMESTAMP to support INSERT ... DEFAULT VALUES
 * Triggers update the value on INSERT and UPDATE to ensure currency
 */
export const generateUpdatedAtColumn = (table: Table): readonly string[] => {
  const hasUpdatedAtField = table.fields.some((field) => field.name === INTRINSIC_UPDATED_AT_COLUMN)
  return !hasUpdatedAtField
    ? [
        `${INTRINSIC_UPDATED_AT_COLUMN} ${timestampColumnType()} NOT NULL ${timestampDefaultClause()}`,
      ]
    : []
}

/**
 * Generate deleted_at column definition if not explicitly defined
 */
export const generateDeletedAtColumn = (table: Table): readonly string[] => {
  const hasDeletedAtField = table.fields.some((field) => field.name === INTRINSIC_DELETED_AT_COLUMN)
  return !hasDeletedAtField ? [`${INTRINSIC_DELETED_AT_COLUMN} ${timestampColumnType()}`] : []
}
