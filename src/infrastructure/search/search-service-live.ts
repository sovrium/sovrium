/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import { SearchService, SearchError } from '@/application/ports/services/search-service'
import { ftsSearch, ftsReindex, ftsCreateIndex } from './fts-manager'

export const SearchServiceLive = Layer.succeed(
  SearchService,
  SearchService.of({
    search: (
      query: string,
      options?: {
        readonly tableName?: string
        readonly limit?: number
        readonly offset?: number
      }
    ) =>
      Effect.tryPromise({
        try: () => ftsSearch(query, options),
        catch: (error: unknown) => new SearchError({ cause: error }),
      }),

    reindex: (tableName: string, fieldName?: string) =>
      Effect.tryPromise({
        try: () => ftsReindex(tableName, fieldName),
        catch: (error: unknown) => new SearchError({ cause: error }),
      }),

    createIndex: (tableName: string, fieldName: string, indexType: string) =>
      Effect.tryPromise({
        try: () => ftsCreateIndex(tableName, fieldName, indexType),
        catch: (error: unknown) => new SearchError({ cause: error }),
      }),
  })
)
