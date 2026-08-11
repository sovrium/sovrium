/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Migration Audit Trail
 *
 * Provides functions to track schema migrations, record checksums, and log rollback operations.
 *
 * ## Why Raw SQL Instead of Drizzle Query Builder?
 *
 * These functions use raw SQL via `executeSQL()` instead of Drizzle's query builder because:
 *
 * 1. **Transaction Type Incompatibility**: The schema-initializer uses `SQL.begin()` from bun:sql,
 *    which provides a transaction object with only an `unsafe()` method for raw SQL execution.
 *
 * 2. **Drizzle Requirement**: Drizzle's query builder (`insert()`, `select()`, `where()`) requires
 *    a full `drizzle()` database instance wrapping an `SQL` client, not the raw transaction object.
 *
 * 3. **Architectural Constraint**: Refactoring to use `db.transaction()` instead of `SQL.begin()`
 *    would require significant changes to schema-initializer.ts and related files.
 *
 * The Drizzle schema definitions in `./drizzle/schema/migration-audit.ts` are used for:
 * - Drizzle migrations (creating the tables)
 * - Type exports for consumers
 * - Table name constants (below)
 *
 * @see src/infrastructure/database/drizzle/schema/migration-audit.ts - Drizzle schema definitions
 * @see src/infrastructure/database/schema-initializer.ts - Uses SQL.begin() transactions
 */

import { createHash } from 'node:crypto'
import { getTableName } from 'drizzle-orm'
import { Effect } from 'effect'
import { logDebug } from '@/infrastructure/logging/logger'
import {
  sovriumMigrationHistory,
  sovriumMigrationLog,
  sovriumSchemaChecksum,
} from '../drizzle/schema'
import { qualifiedSystemTable, systemObjectExistsSql, nowSqlLiteral } from '../sql/dialect-ddl'
import { executeSQL, SQLExecutionError, type TransactionLike } from '../sql/sql-execution'
import { escapeSqlString } from '../sql/sql-utils'
import type { App } from '@/domain/models/app'

// Re-export types from Drizzle schema for consumers
export type {
  SovriumMigrationHistory,
  SovriumMigrationLog,
  SovriumSchemaChecksum,
} from '../drizzle/schema'

/**
 * Table name constants derived from Drizzle schema.
 *
 * `getTableName()` returns the bare table name (`schema_checksum`); the
 * dialect-aware `qualifiedSystemTable()` then prepends `system.` on PostgreSQL
 * (a real schema) or `system_` on SQLite (a flat-prefix table — SQLite has no
 * schemas). This keeps every raw SQL string below dialect-agnostic.
 */
const MIGRATION_HISTORY_TABLE = qualifiedSystemTable(getTableName(sovriumMigrationHistory))
const MIGRATION_LOG_TABLE = qualifiedSystemTable(getTableName(sovriumMigrationLog))
const SCHEMA_CHECKSUM_TABLE = qualifiedSystemTable(getTableName(sovriumSchemaChecksum))

/**
 * Create schema snapshot object from app configuration
 * Extracts tables array (including views) for consistent serialization
 *
 * IMPORTANT: Views are part of table definitions (table.views property).
 * Including tables in the snapshot automatically includes views, since views
 * are nested within table objects. This ensures that view changes trigger
 * schema migrations correctly.
 */
const createSchemaSnapshot = (app: App): { readonly tables: readonly object[] } => ({
  tables: app.tables ?? [],
})

/**
 * Normalize the `schema` column value read back from `system.schema_checksum`
 * into a parsed `{ tables }` object, regardless of dialect.
 *
 * Why this is needed
 * ------------------
 * `storeSchemaChecksum` writes the schema as a JSON **string**. How that value
 * comes back out of a raw `SELECT` depends on the dialect:
 *
 *   - **PostgreSQL** — the column is `jsonb`. The `bun-sql` driver parses a
 *     `jsonb` value to a JavaScript object automatically, so `row.schema` is
 *     already `{ tables: [...] }`.
 *   - **SQLite** — the column is `TEXT` (SQLite has no `jsonb`). A raw
 *     `executeSQL` `SELECT` returns the column verbatim as a JSON **string** —
 *     the Drizzle `mode: 'json'` auto-parse only applies to the query-builder
 *     API, not to the hand-written raw SQL the schema-checksum path uses.
 *
 * Without this normalization, `row.schema.tables` is `undefined` on SQLite and
 * the downstream `calculateChecksum` crashes on `JSON.stringify(undefined)`.
 * The helper is a no-op when the value is already an object (PostgreSQL).
 */
const normalizeStoredSchema = (
  value: unknown
): { readonly tables: readonly object[] } | undefined => {
  if (value === null || value === undefined) return undefined
  const parsed = typeof value === 'string' ? (JSON.parse(value) as unknown) : value
  return parsed as { readonly tables: readonly object[] }
}

/**
 * Recursively sort object keys to ensure consistent serialization
 * PostgreSQL JSONB reorders object properties, so we must normalize before hashing
 */
const sortObjectKeys = (obj: unknown): unknown => {
  if (obj === null || obj === undefined) return obj
  if (typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(sortObjectKeys)

  // Sort object keys alphabetically and recursively sort nested objects
  const objRecord = obj as Record<string, unknown>
  const keys = Object.keys(objRecord).toSorted()

  return keys.reduce(
    (sorted, key) => ({
      ...sorted,
      [key]: sortObjectKeys(objRecord[key]),
    }),
    {} as Record<string, unknown>
  )
}

/**
 * Calculate SHA-256 checksum from schema tables
 * Used by both generation and validation
 *
 * CRITICAL: Properties are sorted before hashing to ensure consistent checksums
 * regardless of property insertion order (JavaScript objects) or JSONB normalization.
 */
const calculateChecksum = (tables: readonly object[]): string => {
  // Sort object keys recursively to normalize property order
  const normalizedTables = sortObjectKeys(tables)
  const schemaJson = JSON.stringify(normalizedTables, undefined, 2)

  return createHash('sha256').update(schemaJson).digest('hex')
}

/**
 * Generate checksum for the current schema state
 * Uses SHA-256 hash of the JSON-serialized schema
 */
export const generateSchemaChecksum = (app: App): string => {
  const schemaSnapshot = createSchemaSnapshot(app)
  return calculateChecksum(schemaSnapshot.tables)
}

/**
 * Record a migration in the history table
 * Stores the checksum, schema snapshot, and timestamp
 */
export const recordMigration = (
  tx: TransactionLike,
  app: App
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const checksum = generateSchemaChecksum(app)
    const schemaSnapshot = createSchemaSnapshot(app)

    // Get the next version number
    const versionQuery = `
      SELECT COALESCE(MAX(version), 0) + 1 as next_version
      FROM ${MIGRATION_HISTORY_TABLE}
    `
    const versionResult = yield* executeSQL(tx, versionQuery)
    // executeSQL returns an array directly, not {rows, rowCount}
    const nextVersion =
      (versionResult[0] as { next_version: number } | undefined)?.next_version ?? 1

    // Insert migration record
    // SECURITY NOTE: Using string interpolation for version (number) and proper escaping for JSON
    // - nextVersion is a number from database query, not user input
    // - checksum is a hex string from SHA-256 hash, safe
    // - schemaSnapshot is JSON-escaped to prevent SQL injection
    // NOTE: JSON.stringify is appropriate here - serializing trusted data for storage, not validation
    // @effect-diagnostics effect/preferSchemaOverJson:off
    const escapedSchema = escapeSqlString(JSON.stringify(schemaSnapshot))
    const insertSQL = `
      INSERT INTO ${MIGRATION_HISTORY_TABLE} (version, checksum, schema)
      VALUES (${nextVersion}, '${checksum}', '${escapedSchema}')
    `
    yield* executeSQL(tx, insertSQL)
    logDebug('[migrations] migration recorded', { version: String(nextVersion) })
  })

/**
 * Log a rollback operation in the migration log table
 * Records the error reason and marks status as COMPLETED
 */
export const logRollbackOperation = (
  tx: TransactionLike,
  reason: string
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    // Escape single quotes in reason string to prevent SQL injection
    const escapedReason = escapeSqlString(reason)
    const insertSQL = `
      INSERT INTO ${MIGRATION_LOG_TABLE} (operation, reason, status)
      VALUES ('ROLLBACK', '${escapedReason}', 'COMPLETED')
    `
    yield* executeSQL(tx, insertSQL)
    logDebug('[migrations] rollback operation logged')
  })

/**
 * Store the schema checksum in the system.schema_checksum table
 * Uses a singleton row with id='singleton' to store the current checksum
 */
export const storeSchemaChecksum = (
  tx: TransactionLike,
  app: App
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const checksum = generateSchemaChecksum(app)
    const schemaSnapshot = createSchemaSnapshot(app)

    // NOTE: JSON.stringify serializes the trusted schema snapshot for storage (Effect Schema not needed)
    // @effect-diagnostics effect/preferSchemaOverJson:off
    const fullSchemaJson = JSON.stringify(schemaSnapshot, undefined, 2)

    // Use INSERT ... ON CONFLICT to update existing singleton row or create new one
    // IMPORTANT: Use same JSON formatting (2-space indent) as calculateChecksum for consistency
    // `NOW()` (Postgres) / `CURRENT_TIMESTAMP` (SQLite) — both dialects support
    // `INSERT ... ON CONFLICT (id) DO UPDATE SET col = excluded.col`.
    const now = nowSqlLiteral()
    const escapedSchema = escapeSqlString(fullSchemaJson)
    const upsertSQL = `
      INSERT INTO ${SCHEMA_CHECKSUM_TABLE} (id, checksum, schema, updated_at)
      VALUES ('singleton', '${checksum}', '${escapedSchema}', ${now})
      ON CONFLICT (id)
      DO UPDATE SET checksum = EXCLUDED.checksum, schema = EXCLUDED.schema, updated_at = ${now}
    `
    yield* executeSQL(tx, upsertSQL)
    logDebug('[migrations] schema checksum stored')
  })

/**
 * Retrieve the previous schema from the system.schema_checksum table
 * Returns undefined if no previous schema exists (first migration)
 */
export const getPreviousSchema = (
  tx: TransactionLike
): Effect.Effect<{ readonly tables: readonly object[] } | undefined, SQLExecutionError> =>
  Effect.gen(function* () {
    // Retrieve previous schema from singleton row
    // Table is guaranteed to exist after Drizzle migrations
    const selectSQL = `SELECT schema FROM ${SCHEMA_CHECKSUM_TABLE} WHERE id = 'singleton'`
    const result = yield* executeSQL(tx, selectSQL)

    if (!result || result.length === 0) {
      logDebug('[migrations] no previous schema found')
      return undefined
    }

    // The `schema` column is `jsonb` on PostgreSQL (auto-parsed to an object)
    // but `TEXT` on SQLite (returned verbatim as a JSON string by raw SQL) —
    // normalize so callers always get a parsed `{ tables }` object.
    const schemaData = normalizeStoredSchema(
      (result[0] as { schema?: unknown } | undefined)?.schema
    )
    return schemaData
  })

/**
 * Retrieve the stored checksum from the system.schema_checksum table
 * Returns undefined if no previous checksum exists (first migration)
 * @public
 */
export const getStoredChecksum = (
  tx: TransactionLike
): Effect.Effect<string | undefined, SQLExecutionError> =>
  Effect.gen(function* () {
    // Check if the checksum table exists first (dialect-aware catalog query).
    const tableExistsResult = yield* executeSQL(tx, systemObjectExistsSql('schema_checksum'))
    const tableExists = (tableExistsResult[0] as { exists: boolean } | undefined)?.exists

    if (!tableExists) {
      logDebug('[migrations] checksum table does not exist')
      return undefined
    }

    // Retrieve checksum from singleton row
    const selectSQL = `SELECT checksum FROM ${SCHEMA_CHECKSUM_TABLE} WHERE id = 'singleton'`
    const result = yield* executeSQL(tx, selectSQL)

    if (!result || result.length === 0) {
      logDebug('[migrations] no stored checksum found')
      return undefined
    }

    const storedChecksum = (result[0] as { checksum: string } | undefined)?.checksum
    return storedChecksum
  })

/**
 * Check if checksum table exists in database
 */
const checksumTableExists = (tx: TransactionLike): Effect.Effect<boolean, SQLExecutionError> =>
  Effect.gen(function* () {
    const tableExistsResult = yield* executeSQL(tx, systemObjectExistsSql('schema_checksum'))
    return (tableExistsResult[0] as { exists: boolean } | undefined)?.exists ?? false
  })

/**
 * Retrieve stored checksum and schema from database
 */
const getStoredChecksumData = (
  tx: TransactionLike
): Effect.Effect<
  { checksum: string; schema: { tables: readonly object[] } } | undefined,
  SQLExecutionError
> =>
  Effect.gen(function* () {
    const selectSQL = `SELECT checksum, schema FROM ${SCHEMA_CHECKSUM_TABLE} WHERE id = 'singleton'`
    const result = yield* executeSQL(tx, selectSQL)

    if (!result || result.length === 0) {
      return undefined
    }

    const row = result[0] as { checksum: string; schema?: unknown } | undefined
    if (!row) return undefined

    // The `schema` column is `jsonb` on PostgreSQL (auto-parsed to an object)
    // but `TEXT` on SQLite (returned verbatim as a JSON string by raw SQL) —
    // normalize so the checksum validation always sees a parsed `{ tables }`.
    const schema = normalizeStoredSchema(row.schema)
    if (!schema) return undefined
    return { checksum: row.checksum, schema }
  })

/**
 * Validate stored checksum against recalculated checksum from stored schema
 * Detects schema drift or checksum tampering
 * Throws error if mismatch detected
 */
export const validateStoredChecksum = (
  tx: TransactionLike
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const tableExists = yield* checksumTableExists(tx)
    if (!tableExists) {
      logDebug('[migrations] checksum table missing — skipping validation')
      return
    }

    const row = yield* getStoredChecksumData(tx)
    if (!row) {
      logDebug('[migrations] no stored checksum — skipping validation')
      return
    }

    const storedChecksum = row.checksum
    const storedSchema = row.schema
    const recalculatedChecksum = calculateChecksum(storedSchema.tables)

    if (storedChecksum !== recalculatedChecksum) {
      const errorMsg =
        'Schema drift detected: checksum mismatch. The stored checksum does not match the recalculated checksum from the stored schema. This indicates database tampering or corruption.'
      return yield* new SQLExecutionError({
        message: errorMsg,
        sql: 'validateStoredChecksum',
        cause: new Error(errorMsg),
      })
    }

    logDebug('[migrations] checksum validation passed')
  })
