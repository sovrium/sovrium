/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
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

export type {
  SovriumMigrationHistory,
  SovriumMigrationLog,
  SovriumSchemaChecksum,
} from '../drizzle/schema'

const MIGRATION_HISTORY_TABLE = qualifiedSystemTable(getTableName(sovriumMigrationHistory))
const MIGRATION_LOG_TABLE = qualifiedSystemTable(getTableName(sovriumMigrationLog))
const SCHEMA_CHECKSUM_TABLE = qualifiedSystemTable(getTableName(sovriumSchemaChecksum))

const createSchemaSnapshot = (app: App): { readonly tables: readonly object[] } => ({
  tables: app.tables ?? [],
})

const normalizeStoredSchema = (
  value: unknown
): { readonly tables: readonly object[] } | undefined => {
  if (value === null || value === undefined) return undefined
  const parsed = typeof value === 'string' ? (JSON.parse(value) as unknown) : value
  return parsed as { readonly tables: readonly object[] }
}

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

const calculateChecksum = (tables: readonly object[]): string => {
  const normalizedTables = sortObjectKeys(tables)
  const schemaJson = JSON.stringify(normalizedTables, undefined, 2)

  return createHash('sha256').update(schemaJson).digest('hex')
}

export const generateSchemaChecksum = (app: App): string => {
  const schemaSnapshot = createSchemaSnapshot(app)
  return calculateChecksum(schemaSnapshot.tables)
}

export const recordMigration = (
  tx: TransactionLike,
  app: App
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    logDebug('[recordMigration] Recording migration in history table...')
    const checksum = generateSchemaChecksum(app)
    const schemaSnapshot = createSchemaSnapshot(app)

    const versionQuery = `
      SELECT COALESCE(MAX(version), 0) + 1 as next_version
      FROM ${MIGRATION_HISTORY_TABLE}
    `
    const versionResult = yield* executeSQL(tx, versionQuery)
    const nextVersion =
      (versionResult[0] as { next_version: number } | undefined)?.next_version ?? 1
    logDebug(`[recordMigration] Next version: ${nextVersion}`)

    const escapedSchema = escapeSqlString(JSON.stringify(schemaSnapshot))
    const insertSQL = `
      INSERT INTO ${MIGRATION_HISTORY_TABLE} (version, checksum, schema)
      VALUES (${nextVersion}, '${checksum}', '${escapedSchema}')
    `
    yield* executeSQL(tx, insertSQL)
    logDebug('[recordMigration] Migration recorded successfully')
  })

export const logRollbackOperation = (
  tx: TransactionLike,
  reason: string
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    logDebug('[logRollbackOperation] Logging rollback operation...')
    const escapedReason = escapeSqlString(reason)
    const insertSQL = `
      INSERT INTO ${MIGRATION_LOG_TABLE} (operation, reason, status)
      VALUES ('ROLLBACK', '${escapedReason}', 'COMPLETED')
    `
    yield* executeSQL(tx, insertSQL)
    logDebug('[logRollbackOperation] Rollback operation logged')
  })

export const storeSchemaChecksum = (
  tx: TransactionLike,
  app: App
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    logDebug('[storeSchemaChecksum] Storing schema checksum...')
    const checksum = generateSchemaChecksum(app)
    const schemaSnapshot = createSchemaSnapshot(app)

    const fullSchemaJson = JSON.stringify(schemaSnapshot, undefined, 2)

    const now = nowSqlLiteral()
    const escapedSchema = escapeSqlString(fullSchemaJson)
    const upsertSQL = `
      INSERT INTO ${SCHEMA_CHECKSUM_TABLE} (id, checksum, schema, updated_at)
      VALUES ('singleton', '${checksum}', '${escapedSchema}', ${now})
      ON CONFLICT (id)
      DO UPDATE SET checksum = EXCLUDED.checksum, schema = EXCLUDED.schema, updated_at = ${now}
    `
    yield* executeSQL(tx, upsertSQL)
    logDebug('[storeSchemaChecksum] Schema checksum stored successfully')
  })

export const getPreviousSchema = (
  tx: TransactionLike
): Effect.Effect<{ readonly tables: readonly object[] } | undefined, SQLExecutionError> =>
  Effect.gen(function* () {
    logDebug('[getPreviousSchema] Retrieving previous schema...')

    const selectSQL = `SELECT schema FROM ${SCHEMA_CHECKSUM_TABLE} WHERE id = 'singleton'`
    const result = yield* executeSQL(tx, selectSQL)

    if (!result || result.length === 0) {
      logDebug('[getPreviousSchema] No previous schema found')
      return undefined
    }

    const schemaData = normalizeStoredSchema(
      (result[0] as { schema?: unknown } | undefined)?.schema
    )
    logDebug('[getPreviousSchema] Previous schema retrieved successfully')
    return schemaData
  })

export const getStoredChecksum = (
  tx: TransactionLike
): Effect.Effect<string | undefined, SQLExecutionError> =>
  Effect.gen(function* () {
    logDebug('[getStoredChecksum] Retrieving stored checksum...')

    const tableExistsResult = yield* executeSQL(tx, systemObjectExistsSql('schema_checksum'))
    const tableExists = (tableExistsResult[0] as { exists: boolean } | undefined)?.exists

    if (!tableExists) {
      logDebug('[getStoredChecksum] Checksum table does not exist')
      return undefined
    }

    const selectSQL = `SELECT checksum FROM ${SCHEMA_CHECKSUM_TABLE} WHERE id = 'singleton'`
    const result = yield* executeSQL(tx, selectSQL)

    if (!result || result.length === 0) {
      logDebug('[getStoredChecksum] No stored checksum found')
      return undefined
    }

    const storedChecksum = (result[0] as { checksum: string } | undefined)?.checksum
    logDebug(`[getStoredChecksum] Retrieved checksum: ${storedChecksum}`)
    return storedChecksum
  })

const checksumTableExists = (tx: TransactionLike): Effect.Effect<boolean, SQLExecutionError> =>
  Effect.gen(function* () {
    const tableExistsResult = yield* executeSQL(tx, systemObjectExistsSql('schema_checksum'))
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

    const row = result[0] as { checksum: string; schema?: unknown } | undefined
    if (!row) return undefined

    const schema = normalizeStoredSchema(row.schema)
    if (!schema) return undefined
    return { checksum: row.checksum, schema }
  })

export const validateStoredChecksum = (
  tx: TransactionLike
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    logDebug('[validateStoredChecksum] Validating stored checksum...')

    const tableExists = yield* checksumTableExists(tx)
    if (!tableExists) {
      logDebug('[validateStoredChecksum] Checksum table does not exist - skipping validation')
      return
    }

    const row = yield* getStoredChecksumData(tx)
    if (!row) {
      logDebug('[validateStoredChecksum] No stored checksum found - skipping validation')
      return
    }

    const storedChecksum = row.checksum
    const storedSchema = row.schema
    const recalculatedChecksum = calculateChecksum(storedSchema.tables)

    logDebug(`[validateStoredChecksum] Stored checksum: ${storedChecksum}`)
    logDebug(`[validateStoredChecksum] Recalculated checksum: ${recalculatedChecksum}`)

    if (storedChecksum !== recalculatedChecksum) {
      const errorMsg =
        'Schema drift detected: checksum mismatch. The stored checksum does not match the recalculated checksum from the stored schema. This indicates database tampering or corruption.'
      logDebug(`[validateStoredChecksum] ${errorMsg}`)
      return yield* new SQLExecutionError({
        message: errorMsg,
        sql: 'validateStoredChecksum',
        cause: new Error(errorMsg),
      })
    }

    logDebug('[validateStoredChecksum] Checksum validation passed')
  })
