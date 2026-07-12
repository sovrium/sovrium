/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { AdminSearchEntityType } from '@/domain/models/api/admin/search/search'
import type { Effect } from 'effect'


export class AdminSearchDatabaseError extends Data.TaggedError('AdminSearchDatabaseError')<{
  readonly cause: unknown
}> {}

export interface AdminSearchIndexHit {
  readonly type: AdminSearchEntityType
  readonly entityId: string
  readonly title: string
  readonly href: string
  readonly updatedAt: Date | string | number
}

export interface AdminSearchUpsertRow {
  readonly type: AdminSearchEntityType
  readonly entityId: string
  readonly title: string
  readonly body: string
  readonly href: string
  readonly updatedAt: Date
}

export interface AdminSearchStaleness {
  readonly isEmpty: boolean
  readonly lastBuiltAt: Date | undefined
}

export class AdminSearchRepository extends Context.Tag('AdminSearchRepository')<
  AdminSearchRepository,
  {
    readonly indexStaleness: () => Effect.Effect<AdminSearchStaleness, AdminSearchDatabaseError>

    readonly rebuildIndex: (input: {
      readonly tables: ReadonlyArray<{
        readonly displayName: string
        readonly textColumns: readonly string[]
      }>
      readonly extraRows: readonly AdminSearchUpsertRow[]
    }) => Effect.Effect<void, AdminSearchDatabaseError>

    readonly search: (
      query: string
    ) => Effect.Effect<readonly AdminSearchIndexHit[], AdminSearchDatabaseError>
  }
>() {}
