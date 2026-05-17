/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, count, eq, gt, isNull } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import {
  FormSubmissionDatabaseError,
  FormSubmissionRepository,
} from '@/application/ports/repositories/form-submission-repository'
import { db } from '@/infrastructure/database'
import { formSubmissions } from '@/infrastructure/database/drizzle/schema/form-submissions'
import { jsonbLiteral } from '@/infrastructure/database/sql/sql-utils'
import type { TopLevelFormSubmissionRow } from '@/application/ports/repositories/form-submission-repository'

/**
 * Build the insert values for a top-level form submission. Conditional
 * spreads keep the call site narrow when optional columns are absent.
 *
 * `data` is wrapped in `jsonbLiteral(...)` to work around drizzle-orm +
 * bun-sql's TEXT-bind behaviour for `jsonb` columns; see the helper's
 * docstring in `sql-utils.ts` for the full explanation.
 *
 * NOTE: the `create` method below (share-link path) does NOT yet apply the
 * same workaround for `submittedData`. That code path predates the JSONB
 * fix and is out of scope for D-3; if a downstream spec exposes a JSONB
 * extraction failure on share-link submissions, switch `submittedData` to
 * `jsonbLiteral(submittedData)` the same way.
 */
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

/**
 * Project a Drizzle insert result back into the port's
 * `TopLevelFormSubmissionRow` shape. Falls back to the input values
 * when the row is missing — should never happen, but the renderer must
 * stay robust against unexpected driver behaviour.
 */
/* eslint-disable unicorn/no-null -- public API contract: linkedRecord* are nullable text columns */
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
/* eslint-enable unicorn/no-null */

/**
 * Form Submission Repository Implementation (Drizzle).
 *
 * `countRecentByIp` filters by `submitted_at > now() - windowSeconds`
 * AND `deleted_at IS NULL`, so soft-deleted submissions don't count
 * toward the rate limit. The DB index on `(ip_address, submitted_at)`
 * makes this efficient even under heavy traffic.
 */
export const FormSubmissionRepositoryLive = Layer.succeed(FormSubmissionRepository, {
  create: ({ pageName, shareToken, tableName, submittedData, guestEmail, ipAddress }) =>
    Effect.tryPromise({
      try: async () => {
        const [row] = await db
          .insert(formSubmissions)
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
      },
      catch: (cause) => new FormSubmissionDatabaseError({ cause }),
    }),

  countRecentByIp: ({ ipAddress, windowSeconds }) =>
    Effect.tryPromise({
      try: async () => {
        const cutoff = new Date(Date.now() - windowSeconds * 1000)
        const [row] = await db
          .select({ size: count() })
          .from(formSubmissions)
          .where(
            and(
              eq(formSubmissions.ipAddress, ipAddress),
              gt(formSubmissions.submittedAt, cutoff),
              isNull(formSubmissions.deletedAt)
            )
          )
        return Number(row?.size ?? 0)
      },
      catch: (cause) => new FormSubmissionDatabaseError({ cause }),
    }),

  createTopLevel: (input) =>
    Effect.tryPromise({
      try: async () => {
        const [row] = await db
          .insert(formSubmissions)
          .values(buildTopLevelInsertValues(input))
          .returning()
        return shapeTopLevelRow(row, input)
      },
      catch: (cause) => new FormSubmissionDatabaseError({ cause }),
    }),

  updateStatus: ({ id, status, statusReason }) =>
    Effect.tryPromise({
      try: () => {
        // Conditional spread keeps the column unchanged when the caller
        // omits a reason; explicitly passing `null` clears any prior
        // failure note (transitioning back to `done`).
        const reasonOverride = statusReason === undefined ? {} : { statusReason }
        return db
          .update(formSubmissions)
          .set({ status, ...reasonOverride })
          .where(eq(formSubmissions.id, id))
          .then(() => undefined)
      },
      catch: (cause) => new FormSubmissionDatabaseError({ cause }),
    }),
})
