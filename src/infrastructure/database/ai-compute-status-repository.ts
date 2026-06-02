/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */



import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/infrastructure/database'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import { aiComputeStatus as aiComputeStatusPg } from '@/infrastructure/database/drizzle/schema/ai'
import { aiComputeStatus as aiComputeStatusSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/ai'

const aiComputeStatus = resolveDialectSchema(aiComputeStatusPg, aiComputeStatusSqlite)

export type AiComputeStatusValue = 'pending' | 'refined' | 'failed' | 'skipped'

export interface AiComputeStatusKey {
  readonly appId: string
  readonly tableName: string
  readonly recordId: string
  readonly fieldName: string
}

export interface AiComputeFieldStatus {
  readonly status: AiComputeStatusValue
  readonly attempt: number
  readonly error?: string
}

const keyMatch = (key: AiComputeStatusKey) =>
  and(
    eq(aiComputeStatus.appId, key.appId),
    eq(aiComputeStatus.tableName, key.tableName),
    eq(aiComputeStatus.recordId, key.recordId),
    eq(aiComputeStatus.fieldName, key.fieldName)
  )

export const readAiComputeStatus = async (
  key: AiComputeStatusKey
): Promise<AiComputeFieldStatus | undefined> => {
  const rows = await db.select().from(aiComputeStatus).where(keyMatch(key)).limit(1)
  const row = rows[0]
  if (!row) return undefined
  return {
    status: row.status as AiComputeStatusValue,
    attempt: row.attempt,
    ...(typeof row.error === 'string' ? { error: row.error } : {}),
  }
}

export const readAiComputeStatusesForRecords = async (
  appId: string,
  tableName: string,
  recordIds: readonly (string | number)[]
): Promise<Map<string, Record<string, AiComputeFieldStatus>>> => {
  const stringIds = recordIds.map((id) => String(id))
  if (stringIds.length === 0) return new Map()
  const rows = await db
    .select()
    .from(aiComputeStatus)
    .where(
      and(
        eq(aiComputeStatus.appId, appId),
        eq(aiComputeStatus.tableName, tableName),
        inArray(aiComputeStatus.recordId, stringIds)
      )
    )
  const grouped = rows.reduce<Record<string, Record<string, AiComputeFieldStatus>>>(
    (acc, row) => ({
      ...acc,
      [row.recordId]: {
        ...(acc[row.recordId] ?? {}),
        [row.fieldName]: {
          status: row.status as AiComputeStatusValue,
          attempt: row.attempt,
          ...(typeof row.error === 'string' ? { error: row.error } : {}),
        },
      },
    }),
    {}
  )
  return new Map(Object.entries(grouped))
}

export const upsertAiComputeStatus = async (
  key: AiComputeStatusKey,
  status: AiComputeStatusValue,
  options: { readonly attempt?: number; readonly error?: string } = {}
): Promise<void> => {
  const now = new Date()
  const errorValue = options.error ?? null
  await db
    .insert(aiComputeStatus)
    .values({
      appId: key.appId,
      tableName: key.tableName,
      recordId: key.recordId,
      fieldName: key.fieldName,
      status,
      attempt: options.attempt ?? 0,
      error: errorValue,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        aiComputeStatus.appId,
        aiComputeStatus.tableName,
        aiComputeStatus.recordId,
        aiComputeStatus.fieldName,
      ],
      set: { status, attempt: options.attempt ?? 0, error: errorValue, updatedAt: now },
    })
    .then(() => undefined)
}
