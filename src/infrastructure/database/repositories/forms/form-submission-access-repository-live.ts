/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, eq, isNull, lt, notInArray } from 'drizzle-orm'
import { FormSubmissionDatabaseError } from '@/application/ports/repositories/forms/form-submission-repository'
import { db } from '@/infrastructure/database'
import { formSubmissionsTable } from '@/infrastructure/database/drizzle/dialect-schema'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import { jsonbLiteral } from '@/infrastructure/database/sql/sql-utils'
import type { FormSubmissionRepository } from '@/application/ports/repositories/forms/form-submission-repository'

/** Wrap a DB promise, adapting failures to FormSubmissionDatabaseError. */
const wrap = makeDbWrap((cause) => new FormSubmissionDatabaseError({ cause }))

/**
 * A stored `data` value as an object: JSONB arrives parsed on PostgreSQL, while
 * SQLite's JSON text column may arrive as the raw string.
 */
const readStoredData = (value: unknown): Record<string, unknown> => {
  const parsed = typeof value === 'string' ? (JSON.parse(value) as unknown) : value
  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {}
}

/**
 * The ledger queries behind a form's private links — a draft's resume link
 * (`saveAndResume`) and a submission's edit link (`editAfterSubmit`): reach a
 * row by the digest of its token, rewrite its answers, and delete the drafts
 * nobody can reopen. Spread into `FormSubmissionRepositoryLive`.
 */
export const FormSubmissionAccessQueries: Pick<
  FormSubmissionRepository['Service'],
  | 'setAccessTokenHash'
  | 'findByAccessToken'
  | 'deleteById'
  | 'deleteDraftsSavedBefore'
  | 'deleteDraftsOutside'
  | 'updateData'
> = {
  setAccessTokenHash: ({ id, accessTokenHash }) =>
    wrap(() => {
      const submissions = formSubmissionsTable()
      return db
        .update(submissions)
        .set({ accessTokenHash })
        .where(eq(submissions.id, id))
        .then(() => undefined)
    }),

  findByAccessToken: ({ formName, accessTokenHash }) =>
    wrap(async () => {
      const submissions = formSubmissionsTable()
      const [row] = await db
        .select({
          id: submissions.id,
          status: submissions.status,
          data: submissions.data,
          submittedAt: submissions.submittedAt,
          linkedRecordId: submissions.linkedRecordId,
          submitterUserId: submissions.submitterUserId,
        })
        .from(submissions)
        .where(
          and(
            eq(submissions.formName, formName),
            eq(submissions.accessTokenHash, accessTokenHash),
            isNull(submissions.deletedAt)
          )
        )
        .limit(1)
      if (row === undefined) return undefined
      return {
        id: row.id,
        status: row.status ?? '',
        data: readStoredData(row.data),
        submittedAt: new Date(row.submittedAt),
        linkedRecordId: row.linkedRecordId ?? null,
        submitterUserId: row.submitterUserId ?? null,
      }
    }),

  deleteById: ({ id }) =>
    wrap(() => {
      const submissions = formSubmissionsTable()
      return db
        .delete(submissions)
        .where(eq(submissions.id, id))
        .then(() => undefined)
    }),

  deleteDraftsSavedBefore: ({ formName, savedBefore }) =>
    wrap(async () => {
      const submissions = formSubmissionsTable()
      const removed = await db
        .delete(submissions)
        .where(
          and(
            eq(submissions.formName, formName),
            eq(submissions.status, 'draft'),
            lt(submissions.submittedAt, savedBefore)
          )
        )
        .returning({ id: submissions.id })
      return removed.length
    }),

  deleteDraftsOutside: ({ formNames }) =>
    wrap(async () => {
      const submissions = formSubmissionsTable()
      const drafts = eq(submissions.status, 'draft')
      const removed = await db
        .delete(submissions)
        .where(
          formNames.length === 0
            ? drafts
            : and(drafts, notInArray(submissions.formName, [...formNames]))
        )
        .returning({ id: submissions.id })
      return removed.length
    }),

  updateData: ({ id, data }) =>
    wrap(() => {
      const submissions = formSubmissionsTable()
      return db
        .update(submissions)
        .set({ data: jsonbLiteral(data) })
        .where(eq(submissions.id, id))
        .then(() => undefined)
    }),
}
