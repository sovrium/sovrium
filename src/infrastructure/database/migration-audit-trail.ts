/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createHash } from 'node:crypto'
import { Effect } from 'effect'
import { logInfo } from '@/infrastructure/logging/effect-logger'
import { executeSQL, type TransactionLike, type SQLExecutionError } from './sql-execution'
import { escapeSqlString } from './sql-utils'
import type { App } from '@/domain/models/app'

// Type imports from Drizzle schema for documentation
// These tables are created by Drizzle migrations (drizzle/0006_*.sql)
export type {
  SovriumMigrationHistory,
  SovriumMigrationLog,
  SovriumSchemaChecksum,
} from './drizzle/schema'

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
      FROM _sovrium_migration_history
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
      INSERT INTO _sovrium_migration_history (version, checksum, schema)
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
      INSERT INTO _sovrium_migration_log (operation, reason, status)
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
      INSERT INTO _sovrium_schema_checksum (id, checksum, schema)
      VALUES ('singleton', '${checksum}', '${escapedSchema}')
      ON CONFLICT (id)
      DO UPDATE SET checksum = EXCLUDED.checksum, schema = EXCLUDED.schema
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
    const selectSQL = `SELECT schema FROM _sovrium_schema_checksum WHERE id = 'singleton'`
    const result = yield* executeSQL(tx, selectSQL)

    if (!result || result.length === 0) {
      logInfo('[getPreviousSchema] No previous schema found')
      return undefined
    }

    const schemaData = (result[0] as { schema: { tables: readonly object[] } } | undefined)?.schema
    logInfo('[getPreviousSchema] Previous schema retrieved successfully')
    return schemaData
  })
