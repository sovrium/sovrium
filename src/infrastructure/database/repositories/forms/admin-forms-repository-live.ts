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
import { formSubmissionsTable } from '@/infrastructure/database/drizzle/dialect-schema'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'

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
 * Drizzle implementation for {@link AdminFormsRepository.listSubmissions}.
 * Pulled out of the `wrap()` callback so the latter stays under the complexity
 * cap. Fetches `limit + 1` rows so the use case can derive `hasMore`.
 */
const listSubmissionsImpl = async (
  filters: AdminSubmissionsListFilters
): Promise<ReadonlyArray<AdminFormSubmissionRow>> => {
  const submissions = formSubmissionsTable()
  const conditions = buildListConditions(filters)
  return (await db
    .select({
      id: submissions.id,
      formName: submissions.formName,
      submittedAt: submissions.submittedAt,
      status: submissions.status,
      deletedAt: submissions.deletedAt,
    })
    .from(submissions)
    .where(and(...conditions))
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
