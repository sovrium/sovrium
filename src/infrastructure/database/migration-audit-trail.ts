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
import { executeSQL, type TransactionLike, type SQLExecutionError } from './sql-execution'
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
 */
const MIGRATION_HISTORY_TABLE = getTableName(sovriumMigrationHistory)
const MIGRATION_LOG_TABLE = getTableName(sovriumMigrationLog)
const SCHEMA_CHECKSUM_TABLE = getTableName(sovriumSchemaChecksum)

/**
 * Create schema snapshot object from app configuration
 * Extracts tables array for consistent serialization
 */
const createSchemaSnapshot = (app: App): { readonly tables: readonly object[] } => ({
  tables: app.tables ?? [],
})

/**
 * Generate checksum for the current schema state
 * Uses SHA-256 hash of the JSON-serialized schema
 */
export const generateSchemaChecksum = (app: App): string => {
  const schemaSnapshot = createSchemaSnapshot(app)
  const schemaJson = JSON.stringify(schemaSnapshot.tables, undefined, 2)
  return createHash('sha256').update(schemaJson).digest('hex')
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
 * Store the schema checksum in the _sovrium_schema_checksum table
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

    // Use INSERT ... ON CONFLICT to update existing singleton row or create new one
    const escapedSchema = escapeSqlString(JSON.stringify(schemaSnapshot))
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
 * Retrieve the previous schema from the _sovrium_schema_checksum table
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
 * Retrieve the stored checksum from the _sovrium_schema_checksum table
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
        WHERE table_name = '${SCHEMA_CHECKSUM_TABLE}'
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
