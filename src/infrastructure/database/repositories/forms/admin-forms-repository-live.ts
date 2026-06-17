/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, count, desc, eq, gt, inArray, isNull, lt, max, type SQL } from 'drizzle-orm'
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

const wrap = makeDbWrap((cause) => new AdminFormsDatabaseError({ cause }))

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
})
