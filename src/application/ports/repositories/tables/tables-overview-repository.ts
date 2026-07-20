/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Context, Data } from 'effect'
import type { Effect } from 'effect'

export interface TableAggregateRow {
  readonly tableName: string
  readonly rowCount: number
  readonly softDeletedCount: number
  readonly lastWriteAt: string | null
}

export class TablesOverviewError extends Data.TaggedError('TablesOverviewError')<{
  readonly cause: unknown
}> {}

export class TablesOverviewRepository extends Context.Tag('TablesOverviewRepository')<
  TablesOverviewRepository,
  {
    readonly aggregateTables: (
      tableNames: ReadonlyArray<string>
    ) => Effect.Effect<ReadonlyArray<TableAggregateRow>, TablesOverviewError>

    readonly countLiveRows: (
      tableNames: ReadonlyArray<string>
    ) => Effect.Effect<ReadonlyArray<number>, TablesOverviewError>

    readonly countWritesPerTable: (
      tableNames: ReadonlyArray<string>,
      windowStart: Readonly<Date>,
      windowEnd: Readonly<Date>
    ) => Effect.Effect<ReadonlyArray<number>, TablesOverviewError>

    readonly countWritesPerBucket: (
      tableNames: ReadonlyArray<string>,
      buckets: ReadonlyArray<{ readonly start: Readonly<Date>; readonly end: Readonly<Date> }>
    ) => Effect.Effect<ReadonlyArray<number>, TablesOverviewError>
  }
>() {}
