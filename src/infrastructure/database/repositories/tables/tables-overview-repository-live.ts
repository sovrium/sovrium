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

const TABLE_FANOUT_CONCURRENCY = 2

interface BucketWindow {
  readonly start: Readonly<Date>
  readonly end: Readonly<Date>
}

interface AggregateQueryRow {
  readonly live_count: number | string | null
  readonly soft_deleted_count: number | string | null
  readonly last_write: Readonly<Date> | string | null | undefined
}

const zeroedAggregate = (tableName: string): TableAggregateRow => ({
  tableName,
  rowCount: 0,
  softDeletedCount: 0,
  lastWriteAt: null,
})

function normalizeIsoTimestamp(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value.endsWith('Z') ? value : `${value}Z`
  }
  return parsed.toISOString()
}

function normalizeLastWrite(raw: Readonly<Date> | string | null | undefined): string | null {
  if (raw === undefined || raw === null) {
    return null
  }
  return raw instanceof Date ? raw.toISOString() : normalizeIsoTimestamp(String(raw))
}

async function aggregateOneTable(tableName: string): Promise<TableAggregateRow> {
  try {
    const rows = await executeRawTyped<AggregateQueryRow>(
      db,
      sql`SELECT SUM(CASE WHEN deleted_at IS NULL THEN 1 ELSE 0 END) AS live_count, SUM(CASE WHEN deleted_at IS NOT NULL THEN 1 ELSE 0 END) AS soft_deleted_count, MAX(updated_at) AS last_write FROM ${sql.identifier(tableName)}`
    )
    const row = rows[0]
    return {
      tableName,
      rowCount: toFiniteCount(row?.live_count),
      softDeletedCount: toFiniteCount(row?.soft_deleted_count),
      lastWriteAt: normalizeLastWrite(row?.last_write),
    }
  } catch {
    return zeroedAggregate(tableName)
  }
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

const bucketAlias = (index: number): string => `bucket_${index}`

async function countWritesPerBucketOneTable(
  tableName: string,
  buckets: ReadonlyArray<BucketWindow>
): Promise<ReadonlyArray<number>> {
  const zeros = buckets.map(() => 0)
  try {
    const bucketColumns = buckets.map(
      (bucket, index) =>
        sql`SUM(CASE WHEN updated_at >= ${bucket.start.toISOString()} AND updated_at < ${bucket.end.toISOString()} THEN 1 ELSE 0 END) AS ${sql.identifier(bucketAlias(index))}`
    )
    const windowStart = new Date(
      buckets.reduce((min, b) => Math.min(min, b.start.getTime()), Number.POSITIVE_INFINITY)
    )
    const windowEnd = new Date(
      buckets.reduce((max, b) => Math.max(max, b.end.getTime()), Number.NEGATIVE_INFINITY)
    )

    const rows = await executeRawTyped(
      db,
      sql`SELECT ${sql.join(bucketColumns, sql.raw(', '))} FROM ${sql.identifier(tableName)} WHERE updated_at >= ${windowStart.toISOString()} AND updated_at < ${windowEnd.toISOString()}`
    )
    const row = rows[0]
    return buckets.map((_bucket, index) => toFiniteCount(row?.[bucketAlias(index)]))
  } catch {
    return zeros
  }
}

export const TablesOverviewRepositoryLive = Layer.succeed(TablesOverviewRepository, {
  aggregateTables: (tableNames) =>
    Effect.all(
      tableNames.map((name) =>
        Effect.tryPromise({
          try: () => aggregateOneTable(name),
          catch: (cause) => new TablesOverviewError({ cause }),
        })
      ),
      { concurrency: TABLE_FANOUT_CONCURRENCY }
    ),

  countLiveRows: (tableNames) =>
    Effect.all(tableNames.map(countLiveRowsOne), { concurrency: TABLE_FANOUT_CONCURRENCY }),

  countWritesPerTable: (tableNames, windowStart, windowEnd) =>
    Effect.all(
      tableNames.map((name) =>
        Effect.tryPromise({
          try: () => countWritesInWindow(name, windowStart, windowEnd),
          catch: (cause) => new TablesOverviewError({ cause }),
        })
      ),
      { concurrency: TABLE_FANOUT_CONCURRENCY }
    ),

  countWritesPerBucket: (tableNames, buckets) =>
    buckets.length === 0
      ? Effect.succeed([])
      : Effect.all(
          tableNames.map((name) =>
            Effect.tryPromise({
              try: () => countWritesPerBucketOneTable(name, buckets),
              catch: (cause) => new TablesOverviewError({ cause }),
            })
          ),
          { concurrency: TABLE_FANOUT_CONCURRENCY }
        ).pipe(
          Effect.map((perTable) =>
            buckets.map((_bucket, index) =>
              perTable.reduce((sum, counts) => sum + (counts[index] ?? 0), 0)
            )
          )
        ),
})
