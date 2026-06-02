/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'


export interface TableSearchInput {
  readonly physicalTable: string
  readonly columns: readonly string[]
  readonly query: string
}

export interface TableSearchMatch {
  readonly id: string
  readonly label: string
}

export class CommandSearchDatabaseError extends Data.TaggedError('CommandSearchDatabaseError')<{
  readonly cause: unknown
}> {}

export class CommandSearchRepository extends Context.Tag('CommandSearchRepository')<
  CommandSearchRepository,
  {
    readonly loadFavoriteIds: (
      userId: string
    ) => Effect.Effect<ReadonlySet<string>, CommandSearchDatabaseError>

    readonly searchTable: (
      input: TableSearchInput
    ) => Effect.Effect<readonly TableSearchMatch[], never>
  }
>() {}
