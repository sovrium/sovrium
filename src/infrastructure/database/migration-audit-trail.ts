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

/**
 * Generate checksum for the current schema state
 * Uses SHA-256 hash of the JSON-serialized schema
 */
export const generateSchemaChecksum = (app: App): string => {
  const schemaJson = JSON.stringify(app.tables ?? [], undefined, 2)
  return createHash('sha256').update(schemaJson).digest('hex')
}

/**
 * Create the _sovrium_migration_history table if it doesn't exist
 * This table tracks all schema migrations with timestamps and checksums
 */
export const ensureMigrationHistoryTable = (
  tx: TransactionLike
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    logInfo('[ensureMigrationHistoryTable] Creating migration history table...')
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS _sovrium_migration_history (
        id SERIAL PRIMARY KEY,
        version INTEGER NOT NULL,
        checksum TEXT NOT NULL,
        schema JSONB,
        applied_at TIMESTAMP DEFAULT NOW()
      )
    `
    yield* executeSQL(tx, createTableSQL)
    logInfo('[ensureMigrationHistoryTable] Migration history table created')
  })

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
    const schemaSnapshot = {
      tables: app.tables ?? [],
    }

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
 * Create the _sovrium_migration_log table if it doesn't exist
 * This table tracks migration operations (including rollbacks) with status and reason
 */
export const ensureMigrationLogTable = (
  tx: TransactionLike
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    logInfo('[ensureMigrationLogTable] Creating migration log table...')
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS _sovrium_migration_log (
        id SERIAL PRIMARY KEY,
        operation TEXT NOT NULL,
        from_version INTEGER,
        to_version INTEGER,
        reason TEXT,
        status TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `
    yield* executeSQL(tx, createTableSQL)
    logInfo('[ensureMigrationLogTable] Migration log table created')
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
