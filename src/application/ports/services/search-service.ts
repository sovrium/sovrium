/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

export class SearchError extends Data.TaggedError('SearchError')<{
  readonly cause: unknown
}> {}

export class SearchService extends Context.Tag('SearchService')<
  SearchService,
  {
    readonly search: (
      query: string,
      options?: {
        readonly tableName?: string
        readonly limit?: number
        readonly offset?: number
      }
    ) => Effect.Effect<readonly Record<string, unknown>[], SearchError>
    readonly reindex: (tableName: string, fieldName?: string) => Effect.Effect<void, SearchError>
    readonly createIndex: (
      tableName: string,
      fieldName: string,
      indexType: string
    ) => Effect.Effect<void, SearchError>
  }
>() {}
