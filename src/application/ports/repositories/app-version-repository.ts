/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data, type Effect } from 'effect'
import type { AppVersion, AppVersionListItem } from '@/domain/models/system'

/**
 * Database error for app-version operations.
 */
export class AppVersionDatabaseError extends Data.TaggedError('AppVersionDatabaseError')<{
  readonly cause: unknown
}> {}

/**
 * Input shape for creating a new immutable version snapshot. The
 * `versionNumber` is server-assigned (auto-increment) and is NOT part of
 * the input — callers see it only via the returned record.
 *
 * `restoredFromVersion` is set by the `versions/:n/restore` flow only;
 * direct publish leaves it undefined.
 */
export interface CreateAppVersionInput {
  readonly snapshot: unknown
  readonly checksum: string
  readonly createdByUserId: string
  readonly message: string
  readonly restoredFromVersion?: number
}

/**
 * App Version Repository Port.
 *
 * Backs `system.sovrium_app_versions`. The table is append-only — there
 * is no `update` and no `delete`. Even rollback creates a NEW version
 * that copies the snapshot (with `restoredFromVersion` set), so the
 * audit log is fully reconstructible.
 *
 * `list()` returns slim items (no JSONB snapshot) so the response stays
 * small even for apps with hundreds of versions; callers fetch a single
 * full snapshot via `get(n)`.
 */
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
    /** Returns the highest-numbered version, or undefined if the table is empty. */
    readonly latest: () => Effect.Effect<AppVersion | undefined, AppVersionDatabaseError>
  }
>() {}
