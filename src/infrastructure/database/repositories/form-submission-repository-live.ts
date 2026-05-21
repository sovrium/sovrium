/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, count, eq, gt, isNull } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  FormSubmissionDatabaseError,
  FormSubmissionRepository,
} from '@/application/ports/repositories/form-submission-repository'
import { db } from '@/infrastructure/database'
import { formSubmissionsTable } from '@/infrastructure/database/drizzle/dialect-schema'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import { jsonbLiteral } from '@/infrastructure/database/sql/sql-utils'
import type { TopLevelFormSubmissionRow } from '@/application/ports/repositories/form-submission-repository'
import type { formSubmissions } from '@/infrastructure/database/drizzle/schema/form-submissions'

const wrap = makeDbWrap((cause) => new FormSubmissionDatabaseError({ cause }))

interface TopLevelInsertInput {
  readonly formName: string
  readonly formId: number
  readonly status: string
  readonly data: Record<string, unknown>
  readonly linkedRecordTable?: string
  readonly linkedRecordId?: string
  readonly ipAddress?: string
  readonly userAgent?: string
}

const buildTopLevelInsertValues = (input: Readonly<TopLevelInsertInput>) => ({
  formName: input.formName,
  formId: input.formId,
  status: input.status,
  data: jsonbLiteral(input.data),
  ...(input.linkedRecordTable !== undefined ? { linkedRecordTable: input.linkedRecordTable } : {}),
  ...(input.linkedRecordId !== undefined ? { linkedRecordId: input.linkedRecordId } : {}),
  ...(input.ipAddress !== undefined ? { ipAddress: input.ipAddress } : {}),
  ...(input.userAgent !== undefined ? { userAgent: input.userAgent } : {}),
})

const shapeTopLevelRow = (
  row: Readonly<typeof formSubmissions.$inferSelect> | undefined,
  input: Readonly<TopLevelInsertInput>
): TopLevelFormSubmissionRow => {
  if (row === undefined) {
    return {
      id: '',
      formName: input.formName,
      formId: input.formId,
      status: input.status,
      data: input.data,
      linkedRecordTable: null,
      linkedRecordId: null,
    }
  }
  return {
    id: row.id,
    formName: row.formName ?? input.formName,
    formId: row.formId ?? input.formId,
    status: row.status ?? input.status,
    data: (row.data ?? input.data) as Record<string, unknown>,
    linkedRecordTable: row.linkedRecordTable ?? null,
    linkedRecordId: row.linkedRecordId ?? null,
  }
}

export const FormSubmissionRepositoryLive = Layer.succeed(FormSubmissionRepository, {
  create: ({ pageName, shareToken, tableName, submittedData, guestEmail, ipAddress }) =>
    wrap(async () => {
      const [row] = await db
        .insert(formSubmissionsTable())
        .values({
          pageName,
          shareToken,
          tableName,
          submittedData,
          ...(guestEmail !== undefined ? { guestEmail } : {}),
          ...(ipAddress !== undefined ? { ipAddress } : {}),
        })
        .returning()
      return (row ?? {}) as Record<string, unknown>
    }),

  countRecentByIp: ({ ipAddress, windowSeconds }) =>
    wrap(async () => {
      const cutoff = new Date(Date.now() - windowSeconds * 1000)
      const submissions = formSubmissionsTable()
      const [row] = await db
        .select({ size: count() })
        .from(submissions)
        .where(
          and(
            eq(submissions.ipAddress, ipAddress),
            gt(submissions.submittedAt, cutoff),
            isNull(submissions.deletedAt)
          )
        )
      return Number(row?.size ?? 0)
    }),

  createTopLevel: (input) =>
    wrap(async () => {
      const [row] = await db
        .insert(formSubmissionsTable())
        .values(buildTopLevelInsertValues(input))
        .returning()
      return shapeTopLevelRow(row, input)
    }),

  updateStatus: ({ id, status, statusReason }) =>
    wrap(() => {
      const reasonOverride = statusReason === undefined ? {} : { statusReason }
      const submissions = formSubmissionsTable()
      return db
        .update(submissions)
        .set({ status, ...reasonOverride })
        .where(eq(submissions.id, id))
        .then(() => undefined)
    }),
})
