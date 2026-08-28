/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, count, desc, eq, gt, gte, inArray, isNull, lt, max, type SQL } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  AdminFormsDatabaseError,
  AdminFormsRepository,
  type AdminFormAggregateRow,
  type AdminFormSubmissionDetailRow,
  type AdminFormSubmissionRow,
  type AdminSubmissionsListFilters,
} from '@/application/ports/repositories/forms/admin-forms-repository'
import { db } from '@/infrastructure/database'
import {
  authUsersTable,
  formSubmissionsTable,
} from '@/infrastructure/database/drizzle/dialect-schema'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import { searchAnyColumn } from '@/infrastructure/database/sql/dialect-sql-helpers'

/** Wrap a DB promise, adapting failures to AdminFormsDatabaseError. */
const wrap = makeDbWrap((cause) => new AdminFormsDatabaseError({ cause }))

/**
 * Build the WHERE-clause condition list for the submissions-list read. Spreads
 * each optional filter immutably so the result is a frozen ReadonlyArray<SQL>;
 * the caller wraps with `and(...)`.
 *
 * The cursor anchors on `submitted_at` — the list is sorted `submitted_at DESC`,
 * so the cursor predicate selects rows strictly older than the cursor's
 * `submittedAt`. UUID id ties are approximated away (Phase 0 — see the use
 * case docstring); moved verbatim from the former route handler.
 */
const buildListConditions = (filters: AdminSubmissionsListFilters): ReadonlyArray<SQL> => {
  const submissions = formSubmissionsTable()
  const formFilter: ReadonlyArray<SQL> = [eq(submissions.formName, filters.formName)]
  const deletedFilter: ReadonlyArray<SQL> = filters.includeDeleted
    ? []
    : [isNull(submissions.deletedAt)]
  const statusFilter: ReadonlyArray<SQL> =
    filters.status !== undefined ? [eq(submissions.status, filters.status)] : []
  const fromFilter: ReadonlyArray<SQL> =
    filters.from !== undefined ? [gt(submissions.submittedAt, filters.from)] : []
  const toFilter: ReadonlyArray<SQL> =
    filters.to !== undefined ? [lt(submissions.submittedAt, filters.to)] : []
  const cursorFilter: ReadonlyArray<SQL> =
    filters.cursorBefore !== undefined ? [lt(submissions.submittedAt, filters.cursorBefore)] : []
  return [
    ...formFilter,
    ...deletedFilter,
    ...statusFilter,
    ...fromFilter,
    ...toFilter,
    ...cursorFilter,
  ]
}

/**
 * The `?q=` predicate: the term occurs in the SUBMITTER'S account `email` or
 * `name` (reached through the `submitter_user_id` join), or in the submission
 * `id` an operator pastes out of a support ticket or an audit `resource.id`.
 *
 * Neither is a rendered column — the inbox grid shows Status and Received and
 * nothing else — which is precisely why the response echoes `appliedQuery`: a
 * client re-filtering the visible cells would throw away every row the server
 * matched on the submitter.
 *
 * **`data` (the submitted body) is NEVER searched.** The D7 redaction lock is a
 * SECURITY boundary here, not a scoping preference: an OPERATOR can list
 * submissions whose bodies the reveal gate refuses them, so a term matched
 * against body content would make this list a confirm/deny oracle over exactly
 * that withheld content, recoverable one substring at a time. Widening this
 * haystack is an [internal ref] D7 change.
 *
 * Also excluded: `status` (it has `?status`), `submittedAt` (bounded by `?from`
 * / `?to`), `formName` (constant — the path already scopes the list to one
 * form), `submitter_ip_hash` (a hash; typing a real IP would return zero rows
 * and read as "nothing came from it") and `user_agent` (where `Mozilla` matches
 * nearly everything — a search that answers "all" answers nothing).
 *
 * Honest limit, stated because it fails SOFT: an ANONYMOUS submission has no
 * `submitter_user_id`, so the LEFT JOIN yields NULLs and only its `id` is
 * searchable. A term that is somebody's e-mail address will not surface the
 * anonymous rows that merely CONTAIN that address in their (unsearched) body.
 */
const buildSearchConditions = (filters: AdminSubmissionsListFilters): ReadonlyArray<SQL> => {
  const submissions = formSubmissionsTable()
  const users = authUsersTable()
  return searchAnyColumn(filters.q, users.email, users.name, submissions.id)
}

/**
 * Drizzle implementation for {@link AdminFormsRepository.listSubmissions}.
 * Pulled out of the `wrap()` callback so the latter stays under the complexity
 * cap. Fetches `limit + 1` rows so the use case can derive `hasMore`.
 *
 * The submitter join is added ONLY when a term is present. It is a LEFT JOIN, so
 * it could ride unconditionally without changing the row set — but the inbox is
 * read on every page load and the join buys nothing when nobody is searching.
 */
const listSubmissionsImpl = async (
  filters: AdminSubmissionsListFilters
): Promise<ReadonlyArray<AdminFormSubmissionRow>> => {
  const submissions = formSubmissionsTable()
  const projection = {
    id: submissions.id,
    formName: submissions.formName,
    submittedAt: submissions.submittedAt,
    status: submissions.status,
    deletedAt: submissions.deletedAt,
  }
  const conditions = buildListConditions(filters)
  if (filters.q === undefined) {
    return (await db
      .select(projection)
      .from(submissions)
      .where(and(...conditions))
      .orderBy(desc(submissions.submittedAt))
      .limit(filters.limit + 1)) as ReadonlyArray<AdminFormSubmissionRow>
  }
  const users = authUsersTable()
  return (await db
    .select(projection)
    .from(submissions)
    .leftJoin(users, eq(users.id, submissions.submitterUserId))
    .where(and(...conditions, ...buildSearchConditions(filters)))
    .orderBy(desc(submissions.submittedAt))
    .limit(filters.limit + 1)) as ReadonlyArray<AdminFormSubmissionRow>
}

/**
 * Admin Forms Repository Implementation (Drizzle).
 *
 * Four dialect-aware reads over `system.form_submissions` backing the admin
 * forms-catalog metadata + the three submissions endpoints. All projection /
 * cursor / pagination logic lives in the `forms-overview` use case; this layer
 * emits only raw queries. Dialect resolution is handled by the per-call
 * `formSubmissionsTable()` selector (PG `system.form_submissions` vs SQLite
 * flat `system_form_submissions`) — moved verbatim from the former route.
 */
export const AdminFormsRepositoryLive = Layer.succeed(AdminFormsRepository, {
  aggregateForForm: (formName) =>
    wrap(async () => {
      const submissions = formSubmissionsTable()
      const rows = (await db
        .select({
          submissionCount: count(),
          lastSubmissionAt: max(submissions.submittedAt),
        })
        .from(submissions)
        .where(
          and(eq(submissions.formName, formName), isNull(submissions.deletedAt))
        )) as ReadonlyArray<AdminFormAggregateRow>
      // eslint-disable-next-line unicorn/no-null -- port type is `Date | string | null`; null is the canonical "no submissions yet" aggregate value
      return rows[0] ?? { submissionCount: 0, lastSubmissionAt: null }
    }),

  listSubmissions: (filters) => wrap(async () => listSubmissionsImpl(filters)),

  findSubmissionDetail: (formName, submissionId) =>
    wrap(async () => {
      const submissions = formSubmissionsTable()
      const rows = (await db
        .select({
          id: submissions.id,
          formName: submissions.formName,
          submittedAt: submissions.submittedAt,
          status: submissions.status,
          deletedAt: submissions.deletedAt,
          data: submissions.data,
        })
        .from(submissions)
        .where(and(eq(submissions.id, submissionId), eq(submissions.formName, formName)))
        .limit(1)) as ReadonlyArray<AdminFormSubmissionDetailRow>
      return rows[0]
    }),

  findSubmissionsByIds: (formName, ids) =>
    wrap(async () => {
      const submissions = formSubmissionsTable()
      // Soft-deleted rows drop silently (per D8: missing AND soft-deleted ids
      // both vanish from the response).
      return (await db
        .select({
          id: submissions.id,
          formName: submissions.formName,
          submittedAt: submissions.submittedAt,
          status: submissions.status,
          deletedAt: submissions.deletedAt,
        })
        .from(submissions)
        .where(
          and(
            inArray(submissions.id, [...ids]),
            eq(submissions.formName, formName),
            isNull(submissions.deletedAt)
          )
        )) as ReadonlyArray<AdminFormSubmissionRow>
    }),

  listSubmissionsWithData: (formName, limit) =>
    wrap(async () => {
      const submissions = formSubmissionsTable()
      return (await db
        .select({
          id: submissions.id,
          formName: submissions.formName,
          submittedAt: submissions.submittedAt,
          status: submissions.status,
          deletedAt: submissions.deletedAt,
          data: submissions.data,
        })
        .from(submissions)
        .where(and(eq(submissions.formName, formName), isNull(submissions.deletedAt)))
        .orderBy(desc(submissions.submittedAt))
        .limit(limit)) as ReadonlyArray<AdminFormSubmissionDetailRow>
    }),

  listSubmissionsSince: (formName, since) =>
    wrap(async () => {
      const submissions = formSubmissionsTable()
      return (await db
        .select({
          id: submissions.id,
          formName: submissions.formName,
          submittedAt: submissions.submittedAt,
          status: submissions.status,
          deletedAt: submissions.deletedAt,
        })
        .from(submissions)
        .where(
          and(
            eq(submissions.formName, formName),
            isNull(submissions.deletedAt),
            gte(submissions.submittedAt, since)
          )
        )) as ReadonlyArray<AdminFormSubmissionRow>
    }),
})
