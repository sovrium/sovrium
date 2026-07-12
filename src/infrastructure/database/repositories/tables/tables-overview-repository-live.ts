/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { sql } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import {
  TablesOverviewError,
  TablesOverviewRepository,
  type TableAggregateRow,
} from '@/application/ports/repositories/tables/tables-overview-repository'
import { db } from '@/infrastructure/database'

async function aggregateOneTable(tableName: string): Promise<TableAggregateRow> {
  try {
    const liveResult = (await db.execute(
      sql`SELECT COUNT(*) AS count FROM ${sql.identifier(tableName)} WHERE deleted_at IS NULL`
    )) as unknown as ReadonlyArray<{ readonly count: number | string }>
    const rowCount = Number(liveResult[0]?.count ?? 0)

    const softDeletedResult = (await db.execute(
      sql`SELECT COUNT(*) AS count FROM ${sql.identifier(tableName)} WHERE deleted_at IS NOT NULL`
    )) as unknown as ReadonlyArray<{ readonly count: number | string }>
    const softDeletedCount = Number(softDeletedResult[0]?.count ?? 0)

    const lastWriteResult = (await db.execute(
      sql`SELECT MAX(updated_at) AS last_write FROM ${sql.identifier(tableName)}`
    )) as unknown as ReadonlyArray<{ readonly last_write: Date | string | undefined }>
    const rawLastWrite = lastWriteResult[0]?.last_write
    const lastWriteAt =
      rawLastWrite === undefined || rawLastWrite === null
        ?
          null
        : rawLastWrite instanceof Date
          ? rawLastWrite.toISOString()
          :
            normalizeIsoTimestamp(String(rawLastWrite))

    return { tableName, rowCount, softDeletedCount, lastWriteAt }
  } catch {
    return { tableName, rowCount: 0, softDeletedCount: 0, lastWriteAt: null }
  }
}

function normalizeIsoTimestamp(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value.endsWith('Z') ? value : `${value}Z`
  }
  return parsed.toISOString()
}

async function countWritesInWindow(
  tableName: string,
  start: Readonly<Date>,
  end: Readonly<Date>
): Promise<number> {
  try {
    const result = (await db.execute(
      sql`SELECT COUNT(*) AS count FROM ${sql.identifier(tableName)} WHERE updated_at >= ${start.toISOString()} AND updated_at < ${end.toISOString()}`
    )) as unknown as ReadonlyArray<{ readonly count: number | string }>
    return Number(result[0]?.count ?? 0)
  } catch {
    return 0
  }
}

export const TablesOverviewRepositoryLive = Layer.succeed(TablesOverviewRepository, {
  aggregateTables: (tableNames) =>
    Effect.tryPromise({
      try: async () => Promise.all(tableNames.map(aggregateOneTable)),
      catch: (cause) => new TablesOverviewError({ cause }),
    }),

  countWritesPerTable: (tableNames, windowStart, windowEnd) =>
    Effect.tryPromise({
      try: () =>
        Promise.all(tableNames.map((name) => countWritesInWindow(name, windowStart, windowEnd))),
      catch: (cause) => new TablesOverviewError({ cause }),
    }),

  countWritesPerBucket: (tableNames, buckets) =>
    Effect.tryPromise({
      try: () =>
        buckets.reduce<Promise<ReadonlyArray<number>>>(
          async (accPromise, bucket) => {
            const acc = await accPromise
            const perTable = await Promise.all(
              tableNames.map((name) => countWritesInWindow(name, bucket.start, bucket.end))
            )
            return [...acc, perTable.reduce((sum, n) => sum + n, 0)]
          },
          Promise.resolve([] as ReadonlyArray<number>)
        ),
      catch: (cause) => new TablesOverviewError({ cause }),
    }),
})
