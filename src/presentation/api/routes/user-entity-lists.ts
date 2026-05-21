/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { sanitizeTableName } from '@/domain/utils/table-naming'
import { db } from '@/infrastructure/database'


export type EntityType = 'record' | 'page'

export interface EntityMutationInput {
  readonly entityType: EntityType
  readonly entityId: string
  readonly tableName: string | null
}

export const parseEntityMutationBody = (body: unknown): EntityMutationInput | undefined => {
  if (typeof body !== 'object' || body === null) return undefined
  const record = body as Record<string, unknown>
  const entityType = typeof record['entityType'] === 'string' ? record['entityType'] : undefined
  const entityId = typeof record['entityId'] === 'string' ? record['entityId'] : undefined
  if (entityType === undefined || entityId === undefined) return undefined
  if (entityType !== 'record' && entityType !== 'page') return undefined
  const tableName = typeof record['tableName'] === 'string' ? record['tableName'] : null
  return { entityType, entityId, tableName }
}

export const recordStillExists = async (entity: {
  readonly entityType: string
  readonly entityId: string
  readonly tableId: string | null
}): Promise<boolean> => {
  if (entity.entityType !== 'record' || entity.tableId === null) return true
  const physicalName = sanitizeTableName(entity.tableId)
  try {
    const rows = (await db.execute(
      sql`SELECT 1 FROM ${sql.identifier(physicalName)} WHERE id = ${entity.entityId} LIMIT 1`
    )) as unknown as readonly unknown[]
    return rows.length > 0
  } catch {
    return false
  }
}

export const filterLiveEntities = async <
  T extends {
    readonly entityType: string
    readonly entityId: string
    readonly tableId: string | null
  },
>(
  rows: readonly T[]
): Promise<readonly T[]> => {
  const existenceFlags = await Promise.all(rows.map((row) => recordStillExists(row)))
  return rows.filter((_, index) => existenceFlags[index])
}
