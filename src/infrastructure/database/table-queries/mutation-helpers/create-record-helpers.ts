/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { parseDatabaseDialectConfig } from '@/domain/models/env/database/database-dialect'
import { type DrizzleTransaction } from '@/infrastructure/database'
import { getBaseTableName } from '@/infrastructure/database/lookup/lookup-view-generators'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import { jsonbLiteral, pgTextArrayLiteral } from '@/infrastructure/database/sql/sql-utils'
import { validateColumnName, validateTableName } from '../shared/validation'

interface PostgresErrorLike {
  readonly code?: string
  readonly constraint?: string
  readonly message?: string
  readonly cause?: PostgresErrorLike
}

function hasUniqueViolationMarkers(obj: PostgresErrorLike | null | undefined): boolean {
  return obj?.code === '23505' || !!obj?.constraint || !!obj?.message?.includes('unique constraint')
}

export function isUniqueConstraintViolation(error: unknown): boolean {
  const err = error as PostgresErrorLike | null | undefined
  return hasUniqueViolationMarkers(err) || hasUniqueViolationMarkers(err?.cause)
}

function hasForeignKeyViolationMarkers(obj: PostgresErrorLike | null | undefined): boolean {
  if (obj === null || obj === undefined) return false
  if (obj.code === '23503') return true
  if (obj.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') return true
  const message = obj.message?.toLowerCase()
  return !!message && (message.includes('foreign key') || message.includes('foreign_key'))
}

export function isForeignKeyViolation(error: unknown): boolean {
  const err = error as PostgresErrorLike | null | undefined
  return hasForeignKeyViolationMarkers(err) || hasForeignKeyViolationMarkers(err?.cause)
}

export function buildInsertClauses(
  fields: Readonly<Record<string, unknown>>,
  arrayColumnTypes?: Readonly<Record<string, string>>
): Readonly<{ columnsClause: unknown; valuesClause: unknown }> {
  const entries = Object.entries(fields)

  const columnIdentifiers = entries.map(([key]) => {
    validateColumnName(key)
    return sql.identifier(key)
  })
  const valueParams = entries.map(([key, value]) => {
    if (Array.isArray(value)) {
      const pgType = arrayColumnTypes?.[key]
      if (pgType === 'ARRAY') {
        const allScalar = value.every(
          (entry) =>
            typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean'
        )
        if (allScalar) return pgTextArrayLiteral(value)
      }
      return jsonbLiteral(value)
    }
    if (value !== null && typeof value === 'object') {
      return jsonbLiteral(value)
    }
    return sql`${value}`
  })

  const columnsClause = sql.join(columnIdentifiers, sql.raw(', '))
  const valuesClause = sql.join(valueParams, sql.raw(', '))

  return { columnsClause, valuesClause }
}

export async function lookupArrayColumnTypes(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  columnNames: ReadonlyArray<string>
): Promise<Readonly<Record<string, string>>> {
  if (columnNames.length === 0) return {}
  if (parseDatabaseDialectConfig().dialect === 'sqlite') return {}
  validateTableName(tableName)
  try {
    const validatedNames = columnNames.map((name) => {
      validateColumnName(name)
      return name
    })
    const inList = sql.join(
      validatedNames.map((n) => sql`${n}`),
      sql.raw(', ')
    )
    const rows = (await executeRaw(
      tx,
      sql`SELECT column_name, data_type FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = ${tableName}
            AND column_name IN (${inList})`
    )) as unknown as ReadonlyArray<{
      readonly column_name: string
      readonly data_type: string
    }>
    return Object.fromEntries(rows.map((r) => [r.column_name, r.data_type]))
  } catch {
    return {}
  }
}

async function resolveViewBackedInsertRow(
  tx: Readonly<DrizzleTransaction>,
  tableName: string
): Promise<Record<string, unknown> | undefined> {
  const { dialect } = parseDatabaseDialectConfig()
  const idQuery =
    dialect === 'postgres'
      ? sql`SELECT lastval() AS id`
      : sql`SELECT MAX(id) AS id FROM ${sql.identifier(getBaseTableName(tableName))}`
  const idRows = await executeRaw(tx, idQuery)
  const newId = idRows[0]?.id
  if (newId === null || newId === undefined) return undefined
  const rows = await executeRaw(
    tx,
    sql`SELECT * FROM ${sql.identifier(tableName)} WHERE id = ${newId} LIMIT 1`
  )
  return rows[0]
}

export async function insertAndResolveRow(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  columnsClause: unknown,
  valuesClause: unknown
): Promise<Readonly<Record<string, unknown>>> {
  const insertResult = await executeRaw(
    tx,
    sql`INSERT INTO ${sql.identifier(tableName)} (${columnsClause}) VALUES (${valuesClause}) RETURNING *`
  )
  const raw = insertResult[0] ?? {}
  if ('id' in raw && raw.id === null) {
    const resolved = await resolveViewBackedInsertRow(tx, tableName)
    if (resolved) return resolved
  }
  return raw
}
