/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

/**
 * Database error for automation digest operations.
 */
export class AutomationDigestDatabaseError extends Data.TaggedError(
  'AutomationDigestDatabaseError'
)<{
  readonly cause: unknown
}> {}

/**
 * Sort hint for `release`. `direction: 'desc'` returns the largest value
 * first, which the spec uses to express "most recent" via a JSONB
 * `timestamp` field.
 */
export interface DigestReleaseSort {
  readonly field: string
  readonly direction: 'asc' | 'desc'
}

/**
 * Automation Digest Repository Port.
 *
 * Backs `digest:collect` and `digest:release` action operators. Collected
 * items pile up in a bucket scoped by `(automation_id, digest_key)`; the
 * bucket transitions from `collecting` → `released` exactly once when
 * `release` is invoked. After release, a new collect creates a fresh
 * bucket — this is what makes the bucket lifecycle observable from the
 * spec's perspective.
 *
 * `dedupe` is opt-in per `collect` call: when `dedupeKey` is provided and
 * a row with the same key already exists in the bucket, the insert is
 * skipped silently and `digestSize` reflects the pre-existing count.
 */
export class AutomationDigestRepository extends Context.Tag('AutomationDigestRepository')<
  AutomationDigestRepository,
  {
    /**
     * Find the active (`status = 'collecting'`) bucket for the given
     * `(automationId, digestKey)`, or create one if none exists. Returns
     * the bucket id.
     */
    readonly findOrCreateActiveBucket: (input: {
      readonly automationId: string
      readonly digestKey: string
    }) => Effect.Effect<string, AutomationDigestDatabaseError>

    /**
     * Append `item` to the active bucket. When `dedupeKey` is provided
     * and a row with the same key already exists in the bucket, the
     * insert is skipped. Returns the post-call digest size.
     */
    readonly addItem: (input: {
      readonly bucketId: string
      readonly item: unknown
      readonly dedupeKey?: string
    }) => Effect.Effect<number, AutomationDigestDatabaseError>

    /**
     * Mark the active bucket for `(automationId, digestKey)` as
     * `released`, set `released_at = now()`, and return its items
     * (optionally sorted/limited). Returns an empty array if no active
     * bucket exists.
     */
    readonly release: (input: {
      readonly automationId: string
      readonly digestKey: string
      readonly sort?: DigestReleaseSort
      readonly limit?: number
    }) => Effect.Effect<readonly unknown[], AutomationDigestDatabaseError>
  }
>() {}
