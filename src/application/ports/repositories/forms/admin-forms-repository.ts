/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

/**
 * Admin Forms Repository Port
 *
 * Type-safe data access backing the four `system.form_submissions` reads that
 * power the admin/forms endpoints:
 *
 *   - `GET /api/admin/forms` + `GET /api/admin/forms/:formName` →
 *     {@link aggregateForForm} (per-form `count(*)` + `max(submitted_at)` used
 *     to populate `_admin.metadata`). The forms *catalog* itself is read from
 *     the in-memory `app.forms[]` config by the use case — only the aggregate
 *     metadata touches the database.
 *   - `GET /api/admin/forms/:formName/submissions` → {@link listSubmissions}
 *     (cursor-paginated, multi-filter scan ordered `submitted_at DESC`).
 *   - `GET /api/admin/forms/:formName/submissions/:submissionId` →
 *     {@link findSubmissionDetail} (single row incl. the `data` body column).
 *   - `POST /api/admin/forms/:formName/submissions/_bulk` →
 *     {@link findSubmissionsByIds} (one `IN (...)` read; soft-deleted rows drop).
 *
 * This is a deliberately separate port from {@link FormSubmissionRepository}.
 * The latter is the public-forms *write* contract (`create`, `createTopLevel`,
 * `reserveTopLevelSlot`, `updateStatus`) plus two narrow count primitives
 * (`countRecentByIp`, `countByFormNameAndStatus`) shaped for rate-limiting and
 * the `maxSubmissions` cap. The admin reads need *raw rows* (id, formName,
 * submittedAt, status, deletedAt, optionally data) with cursor pagination and a
 * multi-filter WHERE contract — none of which exist on the write port, and
 * adding them would distort a write-focused contract consumed by the public
 * submit flow. So the admin reads get their own port (same judgement cluster 4
 * applied for admin-automations vs the automation-run write port).
 *
 * The row types below are defined here (decoupled from Drizzle) so the
 * application layer stays free of an infrastructure dependency. Implementation
 * lives in the infrastructure layer (admin-forms-repository-live.ts).
 */

/**
 * Database error for admin-forms read operations.
 */
export class AdminFormsDatabaseError extends Data.TaggedError('AdminFormsDatabaseError')<{
  readonly cause: unknown
}> {}

/**
 * Per-form aggregate over `form_submissions` — `count(*)` of non-deleted rows
 * plus the latest `submitted_at`. Timestamps stay in their dialect-native
 * `Date | string` shape (Postgres returns `Date`, SQLite either depending on
 * the driver); the use case owns ISO normalization. `submissionCount` is
 * likewise `number | string` because Postgres `count()` returns a bigint
 * serialized as a string.
 */
export interface AdminFormAggregateRow {
  readonly submissionCount: number | string
  readonly lastSubmissionAt: Date | string | null
}

/**
 * Raw submission row used by the list / detail / bulk readers. Mirrors the
 * `form_submissions` projection — timestamps stay dialect-native (`Date |
 * string`) so the use case owns ISO normalization. The `data` body column is
 * only selected by the detail read (jsonb on Postgres, JSON-on-read TEXT on
 * SQLite — drizzle returns the parsed object in both cases).
 */
export interface AdminFormSubmissionRow {
  readonly id: string
  readonly formName: string | null
  readonly submittedAt: Date | string
  readonly status: string | null
  readonly deletedAt: Date | string | null
}

/**
 * Detail-shaped row — {@link AdminFormSubmissionRow} plus the submitted `data`
 * payload, returned only by {@link findSubmissionDetail}.
 */
export interface AdminFormSubmissionDetailRow extends AdminFormSubmissionRow {
  readonly data: unknown
}

/**
 * Resolved WHERE-clause inputs for the submissions-list reader. The use case
 * parses + validates the raw query string (and decodes the opaque cursor) into
 * this shape; the repository turns it into dialect-aware drizzle predicates.
 *
 * - `includeDeleted` — when false, only non-deleted rows are returned.
 * - `cursorBefore` — when set, only rows strictly older than this `submittedAt`
 *   are returned (the use case decodes the opaque cursor into this date).
 * - `q` — the operator's free-text term (see below).
 * - `limit` — the page size; the repository fetches `limit + 1` rows so the use
 *   case can compute `hasMore` / `nextCursor`.
 */
export interface AdminSubmissionsListFilters {
  readonly formName: string
  readonly includeDeleted: boolean
  readonly status?: string | undefined
  readonly from?: Date | undefined
  readonly to?: Date | undefined
  readonly cursorBefore?: Date | undefined
  /**
   * Free-text term over the SUBMITTER'S IDENTITY (the account `email` and
   * `name` behind `submitter_user_id`) and the submission `id`, already trimmed
   * and length-checked by `searchTermSchema`. `undefined` means "no search".
   *
   * The submitted `body` is NEVER part of this haystack. That is the [internal ref] D7
   * redaction lock expressed as a query contract, not a scoping preference: an
   * OPERATOR may LIST submissions whose bodies the reveal gate withholds from
   * them, so a `q` that matched body content would turn this list into a
   * confirm/deny oracle over exactly that withheld content — recoverable one
   * substring at a time, never once calling the endpoint that gates it.
   */
  readonly q?: string | undefined
  readonly limit: number
}

export class AdminFormsRepository extends Context.Service<
  AdminFormsRepository,
  {
    /**
     * Aggregate `count(*)` + `max(submitted_at)` over non-deleted submissions
     * for `formName`. Backs `_admin.metadata.submissionCount` /
     * `lastSubmissionAt` on both the list and detail forms-catalog endpoints.
     */
    readonly aggregateForForm: (
      formName: string
    ) => Effect.Effect<AdminFormAggregateRow, AdminFormsDatabaseError>

    /**
     * Cursor-paginated submissions read. Fetches `filters.limit + 1` rows
     * ordered `submitted_at DESC`, applying every set filter immutably. The
     * extra row lets the use case derive `hasMore` / `nextCursor`.
     */
    readonly listSubmissions: (
      filters: AdminSubmissionsListFilters
    ) => Effect.Effect<readonly AdminFormSubmissionRow[], AdminFormsDatabaseError>

    /**
     * Single-submission lookup by (id, formName), including the `data` body
     * column. Returns `undefined` when no row matches — the route maps that to
     * an anti-enum 404.
     */
    readonly findSubmissionDetail: (
      formName: string,
      submissionId: string
    ) => Effect.Effect<AdminFormSubmissionDetailRow | undefined, AdminFormsDatabaseError>

    /**
     * Bulk read of non-deleted submissions matching any of `ids` within
     * `formName`. Soft-deleted + missing ids drop silently (per D8). The use
     * case re-orders the result by the request id order.
     */
    readonly findSubmissionsByIds: (
      formName: string,
      ids: readonly string[]
    ) => Effect.Effect<readonly AdminFormSubmissionRow[], AdminFormsDatabaseError>

    /**
     * Non-deleted submissions for `formName` INCLUDING the `data` body column,
     * ordered `submitted_at DESC` and capped at `limit`.
     *
     * Callers that need to detect "there are more rows than I will serialize"
     * pass `cap + 1` and inspect the returned length — the extra row is the
     * marker, never serialized. Backs the CSV export endpoint.
     */
    readonly listSubmissionsWithData: (
      formName: string,
      limit: number
    ) => Effect.Effect<readonly AdminFormSubmissionDetailRow[], AdminFormsDatabaseError>

    /**
     * Non-deleted submissions for `formName` at or after `since`, without the
     * `data` body column — the body is what makes this read expensive, and an
     * aggregate over a window does not need it. Unordered and uncapped: the
     * caller reduces the full window.
     */
    readonly listSubmissionsSince: (
      formName: string,
      since: Date
    ) => Effect.Effect<readonly AdminFormSubmissionRow[], AdminFormsDatabaseError>
  }
>()('AdminFormsRepository') {}
