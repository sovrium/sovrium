/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql, type SQL } from 'drizzle-orm'
import {
  retentionCutoff,
  tableRetentionPlans,
  type RetentionCutoff,
  type TableRetentionPlan,
} from '@/domain/models/app/tables/retention-service'
import { db } from '@/infrastructure/database'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import { tableIdentifier } from '@/infrastructure/database/table-queries/statement/validation'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { logInfo } from '@/infrastructure/logging/logger'
import { resolveOperatorTimezone } from '@/infrastructure/process/operator-timezone'
import type { App } from '@/domain/models/app'

/**
 * The table retention EXECUTOR: `tables[].retention: { field?, days }`.
 *
 * Deletes, for good (standing rule S5), every row of a table whose `field` is
 * older than its window — trashed or not — in batches of {@link BATCH_SIZE}
 * until nothing past the window is left, so a backlog empties in one sweep
 * without one giant statement. Quiet by construction: a raw `DELETE`, outside
 * every record write program, so no record automation, table webhook or
 * activity-log entry follows. One log line per table says how many rows went
 * and how many a `restrict` relationship kept.
 *
 * Values are bound parameters and identifiers `sql.identifier` (S3). The
 * comparison is per dialect: on SQLite a datetime is TEXT, read through
 * `julianday` so any spelling the engine reads compares as an instant, and a
 * date through `date`; on PostgreSQL the bound cutoff is cast to the column's
 * kind. An empty `field` compares as NULL, so the row is kept.
 */

/** Rows one statement deletes — Directus's figure, far under either engine's parameter limit. */
const BATCH_SIZE = 500

/** A row's age is past the window. */
const isExpired = (plan: TableRetentionPlan, cutoff: RetentionCutoff): SQL => {
  const column = sql.identifier(plan.column)
  if (plan.compare === 'day') {
    return isSqliteRuntime()
      ? sql`date(${column}) < ${cutoff.day}`
      : sql`${column} < CAST(${cutoff.day} AS date)`
  }
  const instant = cutoff.instant.toISOString()
  return isSqliteRuntime()
    ? sql`julianday(${column}) < julianday(${instant})`
    : sql`${column} < CAST(${instant} AS timestamptz)`
}

/** The relationships of other tables that hold a row of `tableName` with `onDelete: restrict`. */
const restrictingLinks = (
  app: App,
  tableName: string
): readonly { readonly table: string; readonly field: string }[] =>
  (app.tables ?? []).flatMap((table) =>
    table.name === tableName
      ? []
      : table.fields.flatMap((field) =>
          field.type === 'relationship' &&
          'relatedTable' in field &&
          field.relatedTable === tableName &&
          'onDelete' in field &&
          field.onDelete === 'restrict'
            ? [{ table: table.name, field: field.name }]
            : []
        )
  )

/** A row of `tableName` another table still points at through a `restrict` link. */
const isHeld = (app: App, tableName: string): SQL | undefined => {
  const links = restrictingLinks(app, tableName)
  if (links.length === 0) return undefined
  const self = tableIdentifier(tableName)
  return sql.join(
    links.map((link) => {
      const child = tableIdentifier(link.table)
      return sql`EXISTS (SELECT 1 FROM ${child} WHERE ${child}.${sql.identifier(link.field)} = ${self}.${sql.identifier('id')})`
    }),
    sql` OR `
  )
}

/** The ids of the next batch of rows that can go, after `afterId` in id order. */
const nextBatch = async (
  plan: TableRetentionPlan,
  expired: SQL,
  held: SQL | undefined,
  afterId: unknown
): Promise<readonly unknown[]> => {
  const table = tableIdentifier(plan.tableName)
  const id = sql.identifier('id')
  const conditions = [
    expired,
    ...(held === undefined ? [] : [sql`NOT (${held})`]),
    ...(afterId === undefined ? [] : [sql`${id} > ${afterId}`]),
  ]
  const rows = await executeRaw(
    db,
    sql`SELECT ${id} AS id FROM ${table} WHERE ${sql.join(conditions, sql` AND `)} ORDER BY ${id} LIMIT ${BATCH_SIZE}`
  )
  return rows.map((row) => row['id'])
}

/** Delete these rows; answers how many went. */
const deleteRows = async (tableName: string, ids: readonly unknown[]): Promise<number> => {
  const deleted = await executeRaw(
    db,
    sql`DELETE FROM ${tableIdentifier(tableName)} WHERE ${sql.identifier('id')} IN (${sql.join(
      ids.map((id) => sql`${id}`),
      sql`, `
    )}) RETURNING ${sql.identifier('id')}`
  )
  return deleted.length
}

/**
 * Delete one batch; when a constraint the sweep did not foresee refuses it, fall
 * back to the rows that can go one by one, so one such row never stops the
 * table. Answers the rows deleted and the rows kept.
 */
const deleteBatch = async (
  tableName: string,
  ids: readonly unknown[]
): Promise<{ readonly deleted: number; readonly kept: number }> => {
  try {
    return { deleted: await deleteRows(tableName, ids), kept: 0 }
  } catch {
    const outcomes = await Promise.all(
      ids.map(async (id) => {
        try {
          return await deleteRows(tableName, [id])
        } catch {
          return -1
        }
      })
    )
    return {
      deleted: outcomes.filter((outcome) => outcome > 0).length,
      kept: outcomes.filter((outcome) => outcome < 0).length,
    }
  }
}

/** The expired rows a `restrict` link keeps, counted for the log line. */
const countHeld = async (plan: TableRetentionPlan, expired: SQL, held: SQL): Promise<number> => {
  const rows = await executeRaw(
    db,
    sql`SELECT COUNT(*) AS n FROM ${tableIdentifier(plan.tableName)} WHERE ${expired} AND (${held})`
  )
  return Number(rows[0]?.['n'] ?? 0)
}

/** Sweep one table; answers the rows deleted and the rows kept. */
const sweepTable = async (
  app: App,
  plan: TableRetentionPlan,
  now: Readonly<Date>
): Promise<{ readonly deleted: number; readonly kept: number }> => {
  const cutoff = retentionCutoff(now, resolveOperatorTimezone(), plan.days)
  const expired = isExpired(plan, cutoff)
  const held = isHeld(app, plan.tableName)
  const loop = async (
    afterId: unknown,
    total: { readonly deleted: number; readonly kept: number }
  ): Promise<{ readonly deleted: number; readonly kept: number }> => {
    const ids = await nextBatch(plan, expired, held, afterId)
    if (ids.length === 0) return total
    const batch = await deleteBatch(plan.tableName, ids)
    const next = { deleted: total.deleted + batch.deleted, kept: total.kept + batch.kept }
    return ids.length < BATCH_SIZE ? next : loop(ids[ids.length - 1], next)
  }
  const swept = await loop(undefined, { deleted: 0, kept: 0 })
  const kept = swept.kept + (held === undefined ? 0 : await countHeld(plan, expired, held))
  if (swept.deleted > 0 || kept > 0) {
    logInfo(
      `[table-retention] ${plan.tableName}: deleted ${String(swept.deleted)} row(s) older than ${cutoff.instant.toISOString()}${kept > 0 ? `, kept ${String(kept)} still linked` : ''}`
    )
  }
  return { deleted: swept.deleted, kept }
}

/**
 * Run the retention sweep over every table of `app` that declares a window,
 * one table after the other.
 *
 * @param app - the live app config.
 * @param now - the reference instant, injected so the sweep is testable.
 * @returns the rows deleted, per table name.
 */
export async function purgeExpiredTableRows(
  app: App,
  now: Readonly<Date> = new Date()
): Promise<Readonly<Record<string, number>>> {
  const plans = tableRetentionPlans(app.tables)
  return plans.reduce<Promise<Readonly<Record<string, number>>>>(async (previous, plan) => {
    const counts = await previous
    const { deleted } = await sweepTable(app, plan, now)
    return { ...counts, [plan.tableName]: deleted }
  }, Promise.resolve({}))
}
