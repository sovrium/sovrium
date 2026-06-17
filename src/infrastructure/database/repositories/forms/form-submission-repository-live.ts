/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, count, eq, gt, inArray, isNull, sql } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  FormSubmissionDatabaseError,
  FormSubmissionRepository,
} from '@/application/ports/repositories/forms/form-submission-repository'
import { db } from '@/infrastructure/database'
import { formSubmissionsTable } from '@/infrastructure/database/drizzle/dialect-schema'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import { jsonbLiteral } from '@/infrastructure/database/sql/sql-utils'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import type { TopLevelFormSubmissionRow } from '@/application/ports/repositories/forms/form-submission-repository'
import type { formSubmissions } from '@/infrastructure/database/drizzle/schema/form-submissions'

const wrap = makeDbWrap((cause) => new FormSubmissionDatabaseError({ cause }))

interface TopLevelInsertInput {
  readonly formName: string
  readonly formId: number
  readonly status: string
  readonly statusReason?: string
  readonly data: Record<string, unknown>
  readonly linkedRecordTable?: string
  readonly linkedRecordId?: string
  readonly submitterIpHash?: string
  readonly userAgent?: string
  readonly submitterUserId?: string
}

const buildTopLevelInsertValues = (input: Readonly<TopLevelInsertInput>) => ({
  formName: input.formName,
  formId: input.formId,
  status: input.status,
  data: jsonbLiteral(input.data),
  ...(input.statusReason !== undefined ? { statusReason: input.statusReason } : {}),
  ...(input.linkedRecordTable !== undefined ? { linkedRecordTable: input.linkedRecordTable } : {}),
  ...(input.linkedRecordId !== undefined ? { linkedRecordId: input.linkedRecordId } : {}),
  ...(input.submitterIpHash !== undefined ? { submitterIpHash: input.submitterIpHash } : {}),
  ...(input.userAgent !== undefined ? { userAgent: input.userAgent } : {}),
  ...(input.submitterUserId !== undefined ? { submitterUserId: input.submitterUserId } : {}),
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

type ReserveInput = Readonly<
  TopLevelInsertInput & {
    readonly maxSubmissions: number
    readonly countStatuses: readonly string[]
  }
>

const buildStatusListFragment = (statuses: readonly string[]) =>
  statuses.length > 0
    ? sql.join(
        statuses.map((s) => sql`${s}`),
        sql.raw(', ')
      )
    : sql.raw(`''`)

const reserveInsertSql = (input: ReserveInput) => {
  const statusList = buildStatusListFragment(input.countStatuses)
  const linkedTable =
    input.linkedRecordTable === undefined ? sql.raw('NULL') : sql`${input.linkedRecordTable}`
  const linkedId =
    input.linkedRecordId === undefined ? sql.raw('NULL') : sql`${input.linkedRecordId}`
  const ipHash =
    input.submitterIpHash === undefined ? sql.raw('NULL') : sql`${input.submitterIpHash}`
  const ua = input.userAgent === undefined ? sql.raw('NULL') : sql`${input.userAgent}`
  const submitter =
    input.submitterUserId === undefined ? sql.raw('NULL') : sql`${input.submitterUserId}`
  return sql`INSERT INTO system.form_submissions
          (form_name, form_id, status, data, linked_record_table, linked_record_id, submitter_ip_hash, user_agent, submitter_user_id)
        SELECT ${input.formName}, ${input.formId}, ${input.status}, ${jsonbLiteral(input.data)},
               ${linkedTable}, ${linkedId}, ${ipHash}, ${ua}, ${submitter}
        WHERE (
          SELECT COUNT(*) FROM system.form_submissions
          WHERE form_name = ${input.formName}
            AND status IN (${statusList})
            AND deleted_at IS NULL
        ) < ${input.maxSubmissions}
        RETURNING *`
}

const reserveSlotRaw = async (
  input: ReserveInput
): Promise<typeof formSubmissions.$inferSelect | undefined> => {
  if (isSqliteRuntime()) {
    const rows = (await db.execute(reserveInsertSql(input))) as unknown as ReadonlyArray<
      typeof formSubmissions.$inferSelect
    >
    return rows[0]
  }
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${input.formName}, 0))`)
    const rows = (await tx.execute(reserveInsertSql(input))) as unknown as ReadonlyArray<
      typeof formSubmissions.$inferSelect
    >
    return rows[0]
  })
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

  countByFormNameAndStatus: ({ formName, statuses }) =>
    wrap(async () => {
      if (statuses.length === 0) return 0
      const submissions = formSubmissionsTable()
      const [row] = await db
        .select({ size: count() })
        .from(submissions)
        .where(
          and(
            eq(submissions.formName, formName),
            inArray(submissions.status, [...statuses]),
            isNull(submissions.deletedAt)
          )
        )
      return Number(row?.size ?? 0)
    }),

  reserveTopLevelSlot: (input) =>
    wrap(async () => {
      const row = await reserveSlotRaw(input)
      return row === undefined ? undefined : shapeTopLevelRow(row, input)
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
