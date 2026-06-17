/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import {
  TablesOverviewRepository,
  type TableAggregateRow,
  type TablesOverviewError,
} from '@/application/ports/repositories/tables/tables-overview-repository'
import { db } from '@/infrastructure/database'
import type { PeriodPreset, SeriesInterval } from '@/domain/models/api/admin/_shared/period-preset'
import type {
  TablesOverviewResponse,
  TableOverviewBreakdownItem,
} from '@/domain/models/api/admin/tables/overview'

export interface BuildTablesOverviewInput {
  readonly tables: ReadonlyArray<{ readonly displayName: string; readonly dbName: string }>
  readonly period: PeriodPreset
  readonly now: Date
}

interface PeriodSpec {
  readonly interval: SeriesInterval
  readonly bucketCount: number
  readonly bucketMs: number
}

function resolvePeriodSpec(period: PeriodPreset): PeriodSpec {
  if (period === '24h') {
    return { interval: '1h', bucketCount: 24, bucketMs: 60 * 60 * 1000 }
  }
  if (period === '7d') {
    return { interval: '1d', bucketCount: 7, bucketMs: 24 * 60 * 60 * 1000 }
  }
  return { interval: '1d', bucketCount: 30, bucketMs: 24 * 60 * 60 * 1000 }
}

async function countWritesInPeriod(
  dbTableName: string,
  windowStart: Readonly<Date>,
  windowEnd: Readonly<Date>
): Promise<number> {
  try {
    const result = (await db.execute(
      sql`SELECT COUNT(*) AS count FROM ${sql.identifier(dbTableName)} WHERE updated_at >= ${windowStart.toISOString()} AND updated_at < ${windowEnd.toISOString()}`
    )) as unknown as ReadonlyArray<{ readonly count: number | string }>
    return Number(result[0]?.count ?? 0)
  } catch {
    return 0
  }
}

async function countWritesInBucket(
  dbTableNames: ReadonlyArray<string>,
  bucketStart: Readonly<Date>,
  bucketEnd: Readonly<Date>
): Promise<number> {
  const perTable = await Promise.all(
    dbTableNames.map((name) => countWritesInPeriod(name, bucketStart, bucketEnd))
  )
  return perTable.reduce((acc, n) => acc + n, 0)
}

function buildByTable(
  sortedTables: ReadonlyArray<{ readonly displayName: string; readonly dbName: string }>,
  aggregates: ReadonlyArray<TableAggregateRow>,
  perTableWrites: ReadonlyArray<number>
): ReadonlyArray<TableOverviewBreakdownItem> {
  const aggregateByDbName = new Map<string, TableAggregateRow>(
    aggregates.map((row) => [row.tableName, row])
  )
  return sortedTables.map((t, i) => {
    const agg = aggregateByDbName.get(t.dbName)
    return {
      name: t.displayName,
      rowCount: agg?.rowCount ?? 0,
      softDeletedCount: agg?.softDeletedCount ?? 0,
      lastWriteAt: agg?.lastWriteAt ?? null,
      writesInPeriod: perTableWrites[i] ?? 0,
    }
  })
}

async function buildSeriesPoints(
  dbNames: ReadonlyArray<string>,
  windowStart: Readonly<Date>,
  spec: PeriodSpec
): Promise<ReadonlyArray<{ readonly timestamp: string; readonly writes: number }>> {
  const bucketIndexes = Array.from({ length: spec.bucketCount }, (_, i) => i)
  return bucketIndexes.reduce<
    Promise<ReadonlyArray<{ readonly timestamp: string; readonly writes: number }>>
  >(
    async (accPromise, i) => {
      const acc = await accPromise
      const bucketStart = new Date(windowStart.getTime() + i * spec.bucketMs)
      const bucketEnd = new Date(bucketStart.getTime() + spec.bucketMs)
      const writes = await countWritesInBucket(dbNames, bucketStart, bucketEnd)
      return [...acc, { timestamp: bucketStart.toISOString(), writes }]
    },
    Promise.resolve([] as ReadonlyArray<{ readonly timestamp: string; readonly writes: number }>)
  )
}

export const buildTablesOverview = (
  input: BuildTablesOverviewInput
): Effect.Effect<TablesOverviewResponse, TablesOverviewError, TablesOverviewRepository> =>
  Effect.gen(function* () {
    const repo = yield* TablesOverviewRepository

    const sortedTables: ReadonlyArray<{ readonly displayName: string; readonly dbName: string }> =
      [...input.tables].sort((a, b) => a.displayName.localeCompare(b.displayName))
    const dbNames = sortedTables.map((t) => t.dbName)

    const aggregates = yield* repo.aggregateTables(dbNames)

    const spec = resolvePeriodSpec(input.period)
    const windowEnd = input.now
    const windowStart = new Date(windowEnd.getTime() - spec.bucketCount * spec.bucketMs)

    const perTableWrites = yield* Effect.tryPromise({
      try: () =>
        Promise.all(dbNames.map((name) => countWritesInPeriod(name, windowStart, windowEnd))),
      catch: (cause) => cause as TablesOverviewError,
    })

    const byTable = buildByTable(sortedTables, aggregates, perTableWrites)

    const points = yield* Effect.tryPromise({
      try: () => buildSeriesPoints(dbNames, windowStart, spec),
      catch: (cause) => cause as TablesOverviewError,
    })

    const totals = {
      tables: byTable.length,
      total_rows: byTable.reduce((acc, t) => acc + t.rowCount, 0),
      soft_deleted_rows: byTable.reduce((acc, t) => acc + t.softDeletedCount, 0),
      writes_in_period: byTable.reduce((acc, t) => acc + t.writesInPeriod, 0),
    }

    return {
      totals,
      by_table: [...byTable],
      series: { interval: spec.interval, points: [...points] },
    }
  })
