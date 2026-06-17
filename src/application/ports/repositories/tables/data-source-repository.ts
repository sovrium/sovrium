/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { DataFilter, DataSort } from '@/domain/models/app/pages/components/data-source'
import type { Effect } from 'effect'


export interface DataSourceQueryOptions {
  readonly fields?: readonly string[]
  readonly filter?: readonly DataFilter[]
  readonly sort?: readonly DataSort[]
  readonly pageSize?: number
  readonly page?: number
}


export class DataSourceDatabaseError extends Data.TaggedError('DataSourceDatabaseError')<{
  readonly cause: unknown
}> {}


export class DataSourceRepository extends Context.Tag('DataSourceRepository')<
  DataSourceRepository,
  {
    readonly fetchRecords: (
      tableName: string,
      options?: DataSourceQueryOptions
    ) => Effect.Effect<readonly Record<string, unknown>[], DataSourceDatabaseError>

    readonly countRecords: (
      tableName: string,
      filter?: readonly DataFilter[]
    ) => Effect.Effect<number, DataSourceDatabaseError>

    readonly fetchSingleRecord: (
      tableName: string,
      paramField: string,
      paramValue: string,
      fields?: readonly string[]
    ) => Effect.Effect<Record<string, unknown> | undefined, DataSourceDatabaseError>

    readonly fetchUserAssignments: (
      userId: string,
      tableSlug: string
    ) => Effect.Effect<readonly string[], DataSourceDatabaseError>

    readonly fetchUserAccessRoles: (
      userId: string
    ) => Effect.Effect<readonly string[], DataSourceDatabaseError>
  }
>() {}
