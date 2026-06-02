/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { sql } from 'drizzle-orm'
import { db } from '@/infrastructure/database'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import { jsonbLiteral } from '@/infrastructure/database/sql/sql-utils'
import { publishRecordChange } from '@/infrastructure/realtime/record-change-publisher'
import { sanitizeTableName } from './table-queries/shared/field-utils'

export const readCurrentFieldValue = async (
  tableName: string,
  recordId: string,
  fieldName: string
): Promise<unknown> => {
  const sanitized = sanitizeTableName(tableName)
  const rows = await executeRaw(
    db,
    sql`SELECT ${sql.identifier(fieldName)} AS value FROM ${sql.identifier(sanitized)} WHERE id = ${recordId} LIMIT 1`
  )
  return rows[0]?.['value']
}

export const writeBackRefinedValue = async (params: {
  readonly appId: string
  readonly tableName: string
  readonly recordId: string
  readonly fieldName: string
  readonly value: unknown
}): Promise<void> => {
  const { appId, tableName, recordId, fieldName, value } = params
  const sanitized = sanitizeTableName(tableName)
  const isJsonShape = Array.isArray(value) || (value !== null && typeof value === 'object')
  const setExpr = isJsonShape
    ? sql`${sql.identifier(fieldName)} = ${jsonbLiteral(value)}`
    : sql`${sql.identifier(fieldName)} = ${value}`

  const rows = await executeRaw(
    db,
    sql`UPDATE ${sql.identifier(sanitized)} SET ${setExpr} WHERE id = ${recordId} RETURNING *`
  )
  const updated = rows[0]
  if (!updated) return

  const { id: _id, ...fields } = updated

  publishRecordChange({
    appId,
    tableName,
    event: 'update',
    recordId,
    record: { id: recordId, ...fields },
    origin: 'ai-refine',
  })
}
