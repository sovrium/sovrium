/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data, type Effect } from 'effect'
import type { AppVersion, AppVersionListItem, AppVersionSource } from '@/domain/models/system'

export class AppVersionDatabaseError extends Data.TaggedError('AppVersionDatabaseError')<{
  readonly cause: unknown
}> {}

export interface CreateAppVersionInput {
  readonly snapshot: unknown
  readonly checksum: string
  readonly createdByUserId: string
  readonly source: AppVersionSource
  readonly fileChecksum?: string
  readonly message: string
  readonly restoredFromVersion?: number
}

export class AppVersionRepository extends Context.Tag('AppVersionRepository')<
  AppVersionRepository,
  {
    readonly list: () => Effect.Effect<readonly AppVersionListItem[], AppVersionDatabaseError>
    readonly get: (
      versionNumber: number
    ) => Effect.Effect<AppVersion | undefined, AppVersionDatabaseError>
    readonly create: (
      input: CreateAppVersionInput
    ) => Effect.Effect<AppVersion, AppVersionDatabaseError>
    readonly latest: () => Effect.Effect<AppVersion | undefined, AppVersionDatabaseError>
  }
>() {}
