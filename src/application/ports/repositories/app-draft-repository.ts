/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data, type Effect } from 'effect'
import type { AppDraft } from '@/domain/models/system'

/**
 * Database error for app-draft operations.
 */
export class AppDraftDatabaseError extends Data.TaggedError('AppDraftDatabaseError')<{
  readonly cause: unknown
}> {}

/**
 * Upsert payload. `updatedAt` is server-assigned by the implementation
 * (e.g. via `now()` in SQL or `Date.now()` in tests), so callers do not
 * pass it.
 */
export interface UpsertAppDraftInput {
  readonly snapshot: unknown
  readonly baseVersion: number
  readonly updatedByUserId: string
}

/**
 * App Draft Repository Port.
 *
 * Backs `system.sovrium_app_drafts`. Phase 1 contract: ONE row per
 * Sovrium instance (singleton draft). The implementation can use a
 * fixed primary key (e.g. id='singleton') so `upsert` semantics are
 * trivially expressible as `INSERT ... ON CONFLICT DO UPDATE`.
 *
 * `discard()` removes the row (or resets it to a sentinel). Callers
 * that need to re-create from the active version do so by calling
 * `upsert` with the active version's snapshot — that lives in the
 * `discard-draft` use case, not in this port.
 */
export class AppDraftRepository extends Context.Tag('AppDraftRepository')<
  AppDraftRepository,
  {
    readonly get: () => Effect.Effect<AppDraft | undefined, AppDraftDatabaseError>
    readonly upsert: (input: UpsertAppDraftInput) => Effect.Effect<AppDraft, AppDraftDatabaseError>
    readonly discard: () => Effect.Effect<void, AppDraftDatabaseError>
  }
>() {}
