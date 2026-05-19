/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { SessionContextError, type DrizzleTransaction } from '@/infrastructure/database'
import { jsonbLiteral } from '@/infrastructure/database/sql/sql-utils'
import { validateColumnName } from '../shared/validation'

export async function validateFieldsNotEmpty(
  fields: Readonly<Record<string, unknown>>
): Promise<readonly [string, unknown][]> {
  const entries = Object.entries(fields)

  if (entries.length === 0) {
    throw new SessionContextError('Cannot update record with no fields', undefined)
  }

  return entries
}

export function buildUpdateSetClauseCRUD(
  entries: readonly [string, unknown][]
): Readonly<ReturnType<typeof sql.join>> {
  const setClauses = entries.map(([key, value]) => {
    validateColumnName(key)
    if (Array.isArray(value) || (value !== null && typeof value === 'object')) {
      return sql`${sql.identifier(key)} = ${jsonbLiteral(value)}`
    }
    return sql`${sql.identifier(key)} = ${value}`
  })
  return sql.join(setClauses, sql.raw(', '))
}

export async function executeRecordUpdateCRUD(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  recordId: string,
  setClause: Readonly<ReturnType<typeof sql.join>>
): Promise<Record<string, unknown>> {
  try {
    const result = (await tx.execute(
      sql`UPDATE ${sql.identifier(tableName)} SET ${setClause} WHERE id = ${recordId} RETURNING *`
    )) as readonly Record<string, unknown>[]

    if (result.length === 0) {
      throw new Error(`Record not found or access denied`)
    }

    return result[0]!
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    if (errorMsg.includes('not found') || errorMsg.includes('access denied')) {
      throw new SessionContextError(errorMsg, error)
    }
    throw new SessionContextError(`Failed to update record ${recordId} in ${tableName}`, error)
  }
}
