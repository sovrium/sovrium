/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'


export class AdminBucketFilesDatabaseError extends Data.TaggedError(
  'AdminBucketFilesDatabaseError'
)<{
  readonly cause: unknown
}> {}

export interface AdminBucketFileRow {
  readonly id: string
  readonly key: string
  readonly filename: string
  readonly mimeType: string
  readonly size: number
  readonly createdAt: Date | string
}

export interface AdminBucketFilesListFilters {
  readonly sort: 'size' | 'date'
  readonly order: 'asc' | 'desc'
  readonly typePrefix?: string | undefined
  readonly typeExact?: string | undefined
  readonly cursor?: { readonly value: string; readonly id: string } | undefined
  readonly limit: number
}

export class AdminBucketFilesRepository extends Context.Tag('AdminBucketFilesRepository')<
  AdminBucketFilesRepository,
  {
    readonly listFiles: (
      filters: AdminBucketFilesListFilters
    ) => Effect.Effect<readonly AdminBucketFileRow[], AdminBucketFilesDatabaseError>

    readonly sumTotalBytes: () => Effect.Effect<number, AdminBucketFilesDatabaseError>
  }
>() {}
