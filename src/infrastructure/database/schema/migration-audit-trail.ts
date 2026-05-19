/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { createHash } from 'node:crypto'
import { getTableName } from 'drizzle-orm'
import { Effect } from 'effect'
import { logInfo } from '@/infrastructure/logging/logger'
import {
  sovriumMigrationHistory,
  sovriumMigrationLog,
  sovriumSchemaChecksum,
} from '../drizzle/schema'
import { executeSQL, SQLExecutionError, type TransactionLike } from '../sql/sql-execution'
import { escapeSqlString } from '../sql/sql-utils'
import type { App } from '@/domain/models/app'

export type {
  SovriumMigrationHistory,
  SovriumMigrationLog,
  SovriumSchemaChecksum,
} from '../drizzle/schema'

const MIGRATION_HISTORY_TABLE = `system.${getTableName(sovriumMigrationHistory)}`
const MIGRATION_LOG_TABLE = `system.${getTableName(sovriumMigrationLog)}`
const SCHEMA_CHECKSUM_TABLE = `system.${getTableName(sovriumSchemaChecksum)}`

const createSchemaSnapshot = (app: App): { readonly tables: readonly object[] } => ({
  tables: app.tables ?? [],
})

const sortObjectKeys = (obj: unknown): unknown => {
  if (obj === null || obj === undefined) return obj
  if (typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(sortObjectKeys)

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

const calculateChecksum = (tables: readonly object[], context: string = ''): string => {
  const normalizedTables = sortObjectKeys(tables)
  const schemaJson = JSON.stringify(normalizedTables, undefined, 2)

  if (context) {
    logInfo(`[calculateChecksum] DEBUG ${context} - JSON string: ${schemaJson.substring(0, 300)}`)
    logInfo(`[calculateChecksum] DEBUG ${context} - JSON length: ${schemaJson.length}`)
  }
  return createHash('sha256').update(schemaJson).digest('hex')
}

export const generateSchemaChecksum = (app: App): string => {
  const schemaSnapshot = createSchemaSnapshot(app)
  return calculateChecksum(schemaSnapshot.tables, 'GENERATION')
}

export const recordMigration = (
  tx: TransactionLike,
  app: App
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    logInfo('[recordMigration] Recording migration in history table...')
    const checksum = generateSchemaChecksum(app)
    const schemaSnapshot = createSchemaSnapshot(app)

    const versionQuery = `
      SELECT COALESCE(MAX(version), 0) + 1 as next_version
      FROM ${MIGRATION_HISTORY_TABLE}
    `
    const versionResult = yield* executeSQL(tx, versionQuery)
    const nextVersion =
      (versionResult[0] as { next_version: number } | undefined)?.next_version ?? 1
    logInfo(`[recordMigration] Next version: ${nextVersion}`)

    const escapedSchema = escapeSqlString(JSON.stringify(schemaSnapshot))
    const insertSQL = `
      INSERT INTO ${MIGRATION_HISTORY_TABLE} (version, checksum, schema)
      VALUES (${nextVersion}, '${checksum}', '${escapedSchema}')
    `
    yield* executeSQL(tx, insertSQL)
    logInfo('[recordMigration] Migration recorded successfully')
  })

export const logRollbackOperation = (
  tx: TransactionLike,
  reason: string
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    logInfo('[logRollbackOperation] Logging rollback operation...')
    const escapedReason = escapeSqlString(reason)
    const insertSQL = `
      INSERT INTO ${MIGRATION_LOG_TABLE} (operation, reason, status)
      VALUES ('ROLLBACK', '${escapedReason}', 'COMPLETED')
    `
    yield* executeSQL(tx, insertSQL)
    logInfo('[logRollbackOperation] Rollback operation logged')
  })

export const storeSchemaChecksum = (
  tx: TransactionLike,
  app: App
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    logInfo('[storeSchemaChecksum] Storing schema checksum...')
    const checksum = generateSchemaChecksum(app)
    const schemaSnapshot = createSchemaSnapshot(app)

    const tablesJson = JSON.stringify(schemaSnapshot.tables, undefined, 2)
    const fullSchemaJson = JSON.stringify(schemaSnapshot, undefined, 2)
    logInfo(
      `[storeSchemaChecksum] DEBUG - Tables JSON being hashed: ${tablesJson.substring(0, 500)}`
    )
    logInfo(
      `[storeSchemaChecksum] DEBUG - Full schema JSON being stored: ${fullSchemaJson.substring(0, 500)}`
    )
    logInfo(`[storeSchemaChecksum] DEBUG - Generated checksum: ${checksum}`)

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

export const getPreviousSchema = (
  tx: TransactionLike
): Effect.Effect<{ readonly tables: readonly object[] } | undefined, SQLExecutionError> =>
  Effect.gen(function* () {
    logInfo('[getPreviousSchema] Retrieving previous schema...')

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

export const getStoredChecksum = (
  tx: TransactionLike
): Effect.Effect<string | undefined, SQLExecutionError> =>
  Effect.gen(function* () {
    logInfo('[getStoredChecksum] Retrieving stored checksum...')

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
