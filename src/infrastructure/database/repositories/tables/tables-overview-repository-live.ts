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
import { toFiniteCount } from '@/domain/utils/database/count-coercion'
import { db } from '@/infrastructure/database'
import { executeRawTyped } from '@/infrastructure/database/sql/dialect-execute'

async function aggregateOneTable(tableName: string): Promise<TableAggregateRow> {
  try {
    const liveResult = await executeRawTyped<{ readonly count: number | string }>(
      db,
      sql`SELECT COUNT(*) AS count FROM ${sql.identifier(tableName)} WHERE deleted_at IS NULL`
    )
    const rowCount = toFiniteCount(liveResult[0]?.count)

    const softDeletedResult = await executeRawTyped<{ readonly count: number | string }>(
      db,
      sql`SELECT COUNT(*) AS count FROM ${sql.identifier(tableName)} WHERE deleted_at IS NOT NULL`
    )
    const softDeletedCount = toFiniteCount(softDeletedResult[0]?.count)

    const lastWriteResult = await executeRawTyped<{
      readonly last_write: Date | string | undefined
    }>(db, sql`SELECT MAX(updated_at) AS last_write FROM ${sql.identifier(tableName)}`)
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

const countLiveRowsOne = (tableName: string): Effect.Effect<number, TablesOverviewError> =>
  Effect.tryPromise({
    try: async () => {
      try {
        const result = await executeRawTyped<{ readonly count: number | string }>(
          db,
          sql`SELECT COUNT(*) AS count FROM ${sql.identifier(tableName)} WHERE deleted_at IS NULL`
        )
        return toFiniteCount(result[0]?.count)
      } catch {
        return 0
      }
    },
    catch: (cause) => new TablesOverviewError({ cause }),
  })

async function countWritesInWindow(
  tableName: string,
  start: Readonly<Date>,
  end: Readonly<Date>
): Promise<number> {
  try {
    const result = await executeRawTyped<{ readonly count: number | string }>(
      db,
      sql`SELECT COUNT(*) AS count FROM ${sql.identifier(tableName)} WHERE updated_at >= ${start.toISOString()} AND updated_at < ${end.toISOString()}`
    )
    return toFiniteCount(result[0]?.count)
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

  countLiveRows: (tableNames) => Effect.all(tableNames.map(countLiveRowsOne), { concurrency: 2 }),

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
