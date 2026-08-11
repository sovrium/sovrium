/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Origin-marked AI-compute refinement write-back ([internal ref] Phase 2, design §5).
 *
 * The refinement worker writes the refined value back to the dynamic table via
 * this INTERNAL repository UPDATE. By construction it:
 *   (a) broadcasts over realtime with `origin: 'ai-refine'` (so a UI sharpens
 *       the value live), and
 *   (b) STRUCTURALLY omits the automation / webhook taps — it is not the HTTP
 *       update handler, so automations/webhooks never re-fire. The no-double-
 *       fire guarantee is by construction, not a flag check.
 *
 * Dialect-aware via `executeRaw` (PG `.execute()` / SQLite `.all()`), reusing
 * the same parameter-binding helpers as the CRUD update path so JSONB / array
 * values serialize correctly on both engines.
 */

import { sql } from 'drizzle-orm'
import { db } from '@/infrastructure/database'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import { jsonbLiteral } from '@/infrastructure/database/sql/sql-utils'
import { publishRecordChange } from '@/infrastructure/realtime/record-change-publisher'
import { sanitizeTableName } from './table-queries/shared/field-utils'

/** Read the current raw stored value of one column for one record. */
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

/**
 * Write the refined value back to the dynamic table, origin-marked. Publishes a
 * realtime `update` event with `origin: 'ai-refine'`; does NOT fire automations
 * or webhooks (structural — no taps here).
 *
 * Object / array values are inlined as a JSONB literal (mirroring the CRUD
 * update path); scalars bind directly.
 */
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

  // Origin-marked realtime broadcast. Automations + webhooks are NOT fired —
  // this is an internal write-back, not the HTTP update handler.
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
