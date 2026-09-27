/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data, type Effect } from 'effect'
import type { WeeklyDigest } from '@/domain/models/api/admin/notifications/weekly-digest'

/** Database error for the weekly-summary store. */
export class AdminDigestSnapshotDatabaseError extends Data.TaggedError(
  'AdminDigestSnapshotDatabaseError'
)<{
  readonly cause: unknown
}> {}

/**
 * One stored weekly summary.
 *
 * `metrics` is `undefined` when the stored document no longer decodes as a
 * version-1 digest — a row written by a build this one cannot read. The row
 * still says where its period ended, which is all the next period needs; its
 * figures simply cannot be compared against.
 */
export interface AdminDigestSnapshot {
  readonly id: string
  readonly periodStart: Date
  readonly periodEnd: Date
  readonly sentAt: Date | undefined
  readonly recipientCount: number
  readonly metrics: WeeklyDigest | undefined
}

/** What {@link AdminDigestSnapshotRepository.insert} writes. */
export interface NewAdminDigestSnapshot {
  readonly periodStart: Date
  readonly periodEnd: Date
  readonly sentAt: Date | undefined
  readonly recipientCount: number
  readonly metrics: WeeklyDigest
}

/**
 * `system.admin_digest_snapshots` port — the weekly summaries the instance
 * computed, read for the one the next summary compares against.
 */
export class AdminDigestSnapshotRepository extends Context.Service<
  AdminDigestSnapshotRepository,
  {
    /**
     * The current instant on the DATABASE's clock. Most of what the summary
     * counts is stamped by the database (`DEFAULT now()`), whose clock need not
     * agree with this process's — a container's can run ahead of its host's by
     * a fraction of a second or more — so a period ending on the process clock
     * could leave out rows written just before it. The period end is the later
     * of the two. A database value that does not parse answers this process's
     * clock instead.
     */
    readonly clock: Effect.Effect<Date, AdminDigestSnapshotDatabaseError>

    /**
     * The summary with the latest READABLE period end, or `undefined` when none
     * exists. A row whose period does not parse is skipped and logged, never
     * returned: the answer carries only real instants, so the next period
     * cannot become NaN. Only the newest few rows are examined.
     */
    readonly latest: Effect.Effect<
      AdminDigestSnapshot | undefined,
      AdminDigestSnapshotDatabaseError
    >

    /** Store one summary and answer its id. */
    readonly insert: (
      snapshot: NewAdminDigestSnapshot
    ) => Effect.Effect<string, AdminDigestSnapshotDatabaseError>

    /** Record that a stored summary was delivered, to how many addresses, and when. */
    readonly markSent: (input: {
      readonly id: string
      readonly sentAt: Date
      readonly recipientCount: number
    }) => Effect.Effect<void, AdminDigestSnapshotDatabaseError>
  }
>()('AdminDigestSnapshotRepository') {}
