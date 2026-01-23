/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
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
import { logInfo } from '@/infrastructure/logging/effect-logger'
import {
  sovriumMigrationHistory,
  sovriumMigrationLog,
  sovriumSchemaChecksum,
} from './drizzle/schema'
import { executeSQL, SQLExecutionError, type TransactionLike } from './sql-execution'
import { escapeSqlString } from './sql-utils'
import type { App } from '@/domain/models/app'

// Re-export types from Drizzle schema for consumers
export type {
  SovriumMigrationHistory,
  SovriumMigrationLog,
  SovriumSchemaChecksum,
} from './drizzle/schema'

/**
 * Table name constants derived from Drizzle schema
 * Using getTableName() ensures consistency with schema definitions
 * Schema-qualified names are used for system schema tables
 */
const MIGRATION_HISTORY_TABLE = `system.${getTableName(sovriumMigrationHistory)}`
const MIGRATION_LOG_TABLE = `system.${getTableName(sovriumMigrationLog)}`
const SCHEMA_CHECKSUM_TABLE = `system.${getTableName(sovriumSchemaChecksum)}`

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
const calculateChecksum = (tables: readonly object[], context: string = ''): string => {
  // Sort object keys recursively to normalize property order
  const normalizedTables = sortObjectKeys(tables)
  const schemaJson = JSON.stringify(normalizedTables, undefined, 2)

  if (context) {
    logInfo(`[calculateChecksum] DEBUG ${context} - JSON string: ${schemaJson.substring(0, 300)}`)
    logInfo(`[calculateChecksum] DEBUG ${context} - JSON length: ${schemaJson.length}`)
  }
  return createHash('sha256').update(schemaJson).digest('hex')
}

/**
 * Generate checksum for the current schema state
 * Uses SHA-256 hash of the JSON-serialized schema
 */
export const generateSchemaChecksum = (app: App): string => {
  const schemaSnapshot = createSchemaSnapshot(app)
  return calculateChecksum(schemaSnapshot.tables, 'GENERATION')
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
    logInfo('[recordMigration] Recording migration in history table...')
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
    logInfo(`[recordMigration] Next version: ${nextVersion}`)

    // Insert migration record
    // SECURITY NOTE: Using string interpolation for version (number) and proper escaping for JSON
    // - nextVersion is a number from database query, not user input
    // - checksum is a hex string from SHA-256 hash, safe
    // - schemaSnapshot is JSON-escaped to prevent SQL injection
    // NOTE: JSON.stringify is appropriate here - serializing trusted data for storage, not validation
    const escapedSchema = escapeSqlString(JSON.stringify(schemaSnapshot))
    const insertSQL = `
      INSERT INTO ${MIGRATION_HISTORY_TABLE} (version, checksum, schema)
      VALUES (${nextVersion}, '${checksum}', '${escapedSchema}')
    `
    yield* executeSQL(tx, insertSQL)
    logInfo('[recordMigration] Migration recorded successfully')
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
    logInfo('[logRollbackOperation] Logging rollback operation...')
    // Escape single quotes in reason string to prevent SQL injection
    const escapedReason = escapeSqlString(reason)
    const insertSQL = `
      INSERT INTO ${MIGRATION_LOG_TABLE} (operation, reason, status)
      VALUES ('ROLLBACK', '${escapedReason}', 'COMPLETED')
    `
    yield* executeSQL(tx, insertSQL)
    logInfo('[logRollbackOperation] Rollback operation logged')
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
    logInfo('[storeSchemaChecksum] Storing schema checksum...')
    const checksum = generateSchemaChecksum(app)
    const schemaSnapshot = createSchemaSnapshot(app)

    // DEBUG: Log what we're hashing AND storing
    // NOTE: JSON.stringify for pretty-printing debug output, not validation (Effect Schema not needed)
    const tablesJson = JSON.stringify(schemaSnapshot.tables, undefined, 2)
    const fullSchemaJson = JSON.stringify(schemaSnapshot, undefined, 2)
    logInfo(
      `[storeSchemaChecksum] DEBUG - Tables JSON being hashed: ${tablesJson.substring(0, 500)}`
    )
    logInfo(
      `[storeSchemaChecksum] DEBUG - Full schema JSON being stored: ${fullSchemaJson.substring(0, 500)}`
    )
    logInfo(`[storeSchemaChecksum] DEBUG - Generated checksum: ${checksum}`)

    // Use INSERT ... ON CONFLICT to update existing singleton row or create new one
    // IMPORTANT: Use same JSON formatting (2-space indent) as calculateChecksum for consistency
    const escapedSchema = escapeSqlString(fullSchemaJson)
    const upsertSQL = `
      INSERT INTO ${SCHEMA_CHECKSUM_TABLE} (id, checksum, schema, updated_at)
      VALUES ('singleton', '${checksum}', '${escapedSchema}', NOW())
      ON CONFLICT (id)
      DO UPDATE SET checksum = EXCLUDED.checksum, schema = EXCLUDED.schema, updated_at = NOW()
    `
    yield* executeSQL(tx, upsertSQL)
    logInfo('[storeSchemaChecksum] Schema checksum stored successfully')
  })

/**
 * Retrieve the previous schema from the system.schema_checksum table
 * Returns undefined if no previous schema exists (first migration)
 */
export const getPreviousSchema = (
  tx: TransactionLike
): Effect.Effect<{ readonly tables: readonly object[] } | undefined, SQLExecutionError> =>
  Effect.gen(function* () {
    logInfo('[getPreviousSchema] Retrieving previous schema...')

    // Retrieve previous schema from singleton row
    // Table is guaranteed to exist after Drizzle migrations
    const selectSQL = `SELECT schema FROM ${SCHEMA_CHECKSUM_TABLE} WHERE id = 'singleton'`
    const result = yield* executeSQL(tx, selectSQL)

    if (!result || result.length === 0) {
      logInfo('[getPreviousSchema] No previous schema found')
      return undefined
    }

    const schemaData = (result[0] as { schema: { tables: readonly object[] } } | undefined)?.schema
    logInfo('[getPreviousSchema] Previous schema retrieved successfully')
    return schemaData
  })

/**
 * Retrieve the stored checksum from the system.schema_checksum table
 * Returns undefined if no previous checksum exists (first migration)
 */
export const getStoredChecksum = (
  tx: TransactionLike
): Effect.Effect<string | undefined, SQLExecutionError> =>
  Effect.gen(function* () {
    logInfo('[getStoredChecksum] Retrieving stored checksum...')

    // Check if the checksum table exists first
    const tableExistsSQL = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'system' AND table_name = 'schema_checksum'
      ) as exists
    `
    const tableExistsResult = yield* executeSQL(tx, tableExistsSQL)
    const tableExists = (tableExistsResult[0] as { exists: boolean } | undefined)?.exists

    if (!tableExists) {
      logInfo('[getStoredChecksum] Checksum table does not exist')
      return undefined
    }

    // Retrieve checksum from singleton row
    const selectSQL = `SELECT checksum FROM ${SCHEMA_CHECKSUM_TABLE} WHERE id = 'singleton'`
    const result = yield* executeSQL(tx, selectSQL)

    if (!result || result.length === 0) {
      logInfo('[getStoredChecksum] No stored checksum found')
      return undefined
    }

    const storedChecksum = (result[0] as { checksum: string } | undefined)?.checksum
    logInfo(`[getStoredChecksum] Retrieved checksum: ${storedChecksum}`)
    return storedChecksum
  })

/**
 * Check if checksum table exists in database
 */
const checksumTableExists = (tx: TransactionLike): Effect.Effect<boolean, SQLExecutionError> =>
  Effect.gen(function* () {
    const tableExistsSQL = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'system' AND table_name = 'schema_checksum'
      ) as exists
    `
    const tableExistsResult = yield* executeSQL(tx, tableExistsSQL)
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

    return result[0] as { checksum: string; schema: { tables: readonly object[] } } | undefined
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
    logInfo('[validateStoredChecksum] Validating stored checksum...')

    const tableExists = yield* checksumTableExists(tx)
    if (!tableExists) {
      logInfo('[validateStoredChecksum] Checksum table does not exist - skipping validation')
      return
    }

    const row = yield* getStoredChecksumData(tx)
    if (!row) {
      logInfo('[validateStoredChecksum] No stored checksum found - skipping validation')
      return
    }

    const storedChecksum = row.checksum
    const storedSchema = row.schema
    const recalculatedChecksum = calculateChecksum(storedSchema.tables, 'VALIDATION')

    logInfo(`[validateStoredChecksum] Stored checksum: ${storedChecksum}`)
    logInfo(`[validateStoredChecksum] Recalculated checksum: ${recalculatedChecksum}`)

    // DEBUG: Log the actual JSON being hashed (JSON.stringify for debug output, not validation)
    logInfo(
      `[validateStoredChecksum] DEBUG - Stored tables JSON: ${JSON.stringify(storedSchema.tables, undefined, 2).substring(0, 500)}`
    )

    if (storedChecksum !== recalculatedChecksum) {
      const errorMsg =
        'Schema drift detected: checksum mismatch. The stored checksum does not match the recalculated checksum from the stored schema. This indicates database tampering or corruption.'
      logInfo(`[validateStoredChecksum] ${errorMsg}`)
      return yield* new SQLExecutionError({
        message: errorMsg,
        sql: 'validateStoredChecksum',
        cause: new Error(errorMsg),
      })
    }

    logInfo('[validateStoredChecksum] Checksum validation passed')
  })
