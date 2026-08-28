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
import { executeRawTyped } from '@/infrastructure/database/sql/dialect-execute'
import { systemTableRef } from '@/infrastructure/database/sql/dialect-sql'
import { jsonbLiteral } from '@/infrastructure/database/sql/sql-utils'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import type { TopLevelFormSubmissionRow } from '@/application/ports/repositories/forms/form-submission-repository'
import type { formSubmissions } from '@/infrastructure/database/drizzle/schema/form-submissions'

/** Wrap a DB promise, adapting failures to FormSubmissionDatabaseError. */
const wrap = makeDbWrap((cause) => new FormSubmissionDatabaseError({ cause }))

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
  readonly statusReason?: string
  readonly data: Record<string, unknown>
  readonly linkedRecordTable?: string
  readonly linkedRecordId?: string
  /**
   * SHA-256(`FORM_IP_HASH_SALT` + raw IP) as 64 hex chars. [internal ref]
   * + S5: raw IP is NEVER persisted on the top-level forms write path —
   * the hash lands in `submitter_ip_hash` and the legacy `ip_address`
   * column stays NULL.
   */
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

type ReserveInput = Readonly<
  TopLevelInsertInput & {
    readonly maxSubmissions: number
    readonly countStatuses: readonly string[]
  }
>

/** Comma-separated SQL fragment of bound status literals for the `IN (...)` list. */
const buildStatusListFragment = (statuses: readonly string[]) =>
  statuses.length > 0
    ? sql.join(
        statuses.map((s) => sql`${s}`),
        sql.raw(', ')
      )
    : sql.raw(`''`)

/**
 * Columns this raw statement must supply itself on SQLite, and the values a
 * Drizzle-mapped insert would have generated for them.
 *
 * `id` and `submitted_at` are `NOT NULL` on both engines, but only Postgres
 * backs them with a DB-side default (`gen_random_uuid()` / `now()`). The
 * sqlite-core mirror declares them as ORM-side `$defaultFn`s, which a raw
 * `INSERT ... SELECT` bypasses entirely — so omitting them raised
 * `NOT NULL constraint failed: system_form_submissions.id`. The values
 * mirror the mirror's own `$defaultFn`s: a UUID, and `submitted_at` as epoch
 * milliseconds (the column is `integer` with `mode: 'timestamp_ms'`).
 *
 * Deliberately NOT fixed by adding defaults to the SQLite DDL: migration
 * `0000` is released and immutable (see the Drizzle infrastructure doc), and
 * the ORM-side defaults are correct for every Drizzle-mapped writer. Only
 * this hand-written statement needs to carry them.
 */
const sqliteGeneratedColumns = () => ({
  columns: sql.raw(', id, submitted_at'),
  values: sql`, ${crypto.randomUUID()}, ${Date.now()}`,
})

/**
 * The cap-guarded `INSERT ... SELECT ... WHERE (count) < cap` statement.
 *
 * The ledger is referenced through {@link systemTableRef} rather than the
 * literal `system.form_submissions`: SQLite has no schemas, so the same table
 * is the flat `system_form_submissions` there. A hardcoded dotted name made
 * every capped submission fail on the zero-config default engine.
 */
const reserveInsertSql = (input: ReserveInput) => {
  const ledger = systemTableRef('form_submissions')
  const generated = isSqliteRuntime()
    ? sqliteGeneratedColumns()
    : { columns: sql.raw(''), values: sql.raw('') }
  const statusList = buildStatusListFragment(input.countStatuses)
  // Optional text columns bind as SQL NULL via `sql.raw('NULL')` (avoids
  // passing a JS `null` literal, which the project's lint rules forbid).
  const linkedTable =
    input.linkedRecordTable === undefined ? sql.raw('NULL') : sql`${input.linkedRecordTable}`
  const linkedId =
    input.linkedRecordId === undefined ? sql.raw('NULL') : sql`${input.linkedRecordId}`
  // [internal ref] + S5: raw IP never lands in `ip_address` on the top-level
  // forms path — the hash goes to `submitter_ip_hash` instead.
  const ipHash =
    input.submitterIpHash === undefined ? sql.raw('NULL') : sql`${input.submitterIpHash}`
  const ua = input.userAgent === undefined ? sql.raw('NULL') : sql`${input.userAgent}`
  const submitter =
    input.submitterUserId === undefined ? sql.raw('NULL') : sql`${input.submitterUserId}`
  return sql`INSERT INTO ${ledger}
          (form_name, form_id, status, data, linked_record_table, linked_record_id, submitter_ip_hash, user_agent, submitter_user_id${generated.columns})
        SELECT ${input.formName}, ${input.formId}, ${input.status}, ${jsonbLiteral(input.data)},
               ${linkedTable}, ${linkedId}, ${ipHash}, ${ua}, ${submitter}${generated.values}
        WHERE (
          SELECT COUNT(*) FROM ${ledger}
          WHERE form_name = ${input.formName}
            AND status IN (${statusList})
            AND deleted_at IS NULL
        ) < ${input.maxSubmissions}
        RETURNING *`
}

/**
 * Atomic cap-reservation insert.
 *
 * The `INSERT ... SELECT ... WHERE (count) < cap` statement is not race-free
 * on its own under PostgreSQL READ COMMITTED — concurrent transactions each
 * see only committed rows, so several can observe the same pre-insert count
 * and overshoot the cap. To serialize reservations per form we acquire a
 * transaction-scoped advisory lock keyed on the form name BEFORE the insert;
 * the lock auto-releases at commit. Each lock holder therefore sees every
 * prior holder's committed row, so at most `maxSubmissions` inserts succeed.
 *
 * SQLite serialises all writes via its database-level write lock, so the
 * advisory-lock dance is unnecessary there — the bare insert is already
 * atomic against concurrent writers.
 *
 * Returns the inserted row, or `undefined` when the cap was already reached
 * (the WHERE guard short-circuits the SELECT so zero rows insert).
 */
const reserveSlotRaw = async (
  input: ReserveInput
): Promise<typeof formSubmissions.$inferSelect | undefined> => {
  if (isSqliteRuntime()) {
    // `drizzle-orm/sqlite-core` exposes run/all/get/values and has NO
    // `.execute()`; calling it here threw a TypeError that the forms route
    // reported as a 422 validation rejection. `executeRawTyped` is the
    // dialect-aware seam that picks `.all()` on this engine — and `.all()`
    // returns the RETURNING row for SQLite >= 3.35, which Bun ships.
    const rows = await executeRawTyped<typeof formSubmissions.$inferSelect>(
      db,
      reserveInsertSql(input)
    )
    return rows[0]
  }
  return db.transaction(async (tx) => {
    // Transaction-scoped advisory lock keyed on the form name. `hashtextextended`
    // maps the name to a bigint lock key; the lock blocks concurrent
    // reservations for the SAME form and is released automatically on commit.
    // eslint-disable-next-line functional/no-expression-statements
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${input.formName}, 0))`)
    const rows = (await tx.execute(reserveInsertSql(input))) as unknown as ReadonlyArray<
      typeof formSubmissions.$inferSelect
    >
    return rows[0]
  })
}

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
      // Atomic cap reservation: insert one row IFF the count of non-deleted
      // rows with a counted status is strictly below the cap. The count
      // subquery runs inside the INSERT...SELECT statement, so two
      // concurrent requests cannot both observe the same pre-insert count
      // and overshoot the cap — at most `maxSubmissions` inserts succeed.
      const row = await reserveSlotRaw(input)
      return row === undefined ? undefined : shapeTopLevelRow(row, input)
    }),

  updateStatus: ({ id, status, statusReason }) =>
    wrap(() => {
      // Conditional spread keeps the column unchanged when the caller
      // omits a reason; explicitly passing `null` clears any prior
      // failure note (transitioning back to `done`).
      const reasonOverride = statusReason === undefined ? {} : { statusReason }
      const submissions = formSubmissionsTable()
      return db
        .update(submissions)
        .set({ status, ...reasonOverride })
        .where(eq(submissions.id, id))
        .then(() => undefined)
    }),
})
