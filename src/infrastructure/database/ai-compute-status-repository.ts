/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable functional/no-expression-statements -- this repository is the
   I/O boundary: `await db.insert(...)` / `await db.select(...)` are intentional
   effectful statements, the same shape as the other Drizzle repositories. */

/**
 * `system.ai_compute_status` access ([internal ref] Phase 2, design §3 Option A).
 *
 * The observable refinement signal: one row per `(appId, tableName, recordId,
 * fieldName)` carrying the `pending | refined | failed | skipped` lifecycle.
 * The shared worker (`refineAiComputeField`) UPSERTs the lifecycle; the
 * record-API `_aiCompute` projection reads it. Cross-dialect via the
 * `resolveDialectSchema` selector + Drizzle query builder (no raw SQL).
 *
 * Plain async functions (not an Effect Layer) so both the application worker
 * and the presentation read-projection can consume them directly — the worker
 * wraps the writes in `Effect.tryPromise`, the projection awaits the read.
 */

import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/infrastructure/database'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import { aiComputeStatus as aiComputeStatusPg } from '@/infrastructure/database/drizzle/schema/ai'
import { aiComputeStatus as aiComputeStatusSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/ai'

const aiComputeStatus = resolveDialectSchema(aiComputeStatusPg, aiComputeStatusSqlite)

/** The terminal + in-flight refinement lifecycle states. */
export type AiComputeStatusValue = 'pending' | 'refined' | 'failed' | 'skipped'

/** A status row keyed by `(appId, tableName, recordId, fieldName)`. */
export interface AiComputeStatusKey {
  readonly appId: string
  readonly tableName: string
  readonly recordId: string
  readonly fieldName: string
}

/** The projection shape returned to the record-API `_aiCompute` block. */
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

/**
 * Read the current status row for a key, or `undefined` when none exists.
 */
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

/**
 * Read every status row for a set of records on one table (one query). Returns
 * a `recordId → { fieldName → status }` map for the record-API projection.
 *
 * `recordId`s are stringified to match the `text` column (works for both the
 * INTEGER and TEXT dynamic-table id types, [internal ref]).
 */
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
  // Group rows into a plain object-of-objects (immutable), then build the Map.
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

/**
 * UPSERT the lifecycle state for a key. On conflict (existing row) the status /
 * attempt / error / updatedAt are overwritten. `attempt` is supplied by the
 * caller (the worker increments it when transitioning to `pending`).
 */
export const upsertAiComputeStatus = async (
  key: AiComputeStatusKey,
  status: AiComputeStatusValue,
  options: { readonly attempt?: number; readonly error?: string } = {}
): Promise<void> => {
  const now = new Date()
  // eslint-disable-next-line unicorn/no-null -- `error` is a nullable text column; null clears a prior failure reason.
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
