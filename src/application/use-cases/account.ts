/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Use cases for the authenticated account self-service / GDPR endpoints
 * (`GET /api/account/export`, `POST /api/account/delete`).
 *
 * The application layer owns ALL pure logic:
 *   - the export-payload shaping (id/created_at/updated_at split for authored
 *     records, ISO 8601 coercion of every timestamp, Better-Auth `role` →
 *     export-enum normalization),
 *   - assembling the export body and validating it against the Zod response
 *     contract (byte-for-byte identical to the former route — it is a
 *     user-facing GDPR data export),
 *   - the scheduled-erasure grace-period arithmetic + the cancelled/scheduled
 *     response-body validation.
 *
 * Only the raw auth-table reads, the POSTGRES-ONLY `information_schema`
 * introspection, the dynamic authored-record scans, and the transactional
 * schedule-erasure write live in the infrastructure repository, accessed via
 * {@link AccountRepository}. The audit emit (`account.deletion.scheduled`) and
 * the `process.env`/auth resolution stay in the route — mirroring the
 * admin-forms cluster, where the audit emit is performed by the route after a
 * successful use-case run.
 */

// eslint-disable-next-line no-restricted-syntax -- Account self-service / GDPR is a cross-cutting concern, not phase-specific
import { Effect } from 'effect'
import {
  AccountRepository,
  type AuthoredTableCandidate,
  type AccountDatabaseError,
  type AccountFormSubmissionRow,
  type AccountLinkedRow,
  type AccountSessionRow,
  type AccountUserRow,
} from '@/application/ports/repositories/auth/account-repository'
import {
  accountDeleteCancelledResponseSchema,
  accountDeleteScheduledResponseSchema,
  accountExportResponseSchema,
  accountPendingErasureResponseSchema,
} from '@/domain/models/api/account/account'
import { decodeOrThrow } from '@/domain/models/api/combinators/decode'
import { isAdminRole } from '@/domain/models/app/auth/permission-evaluation'
import { SHARED_POOL_FANOUT_CONCURRENCY } from '@/infrastructure/database/sql/db-effect'

/** Grace period (days) before a scheduled erasure is hard-purged. */
export const GRACE_PERIOD_DAYS = 7

// ─── Pure export-payload helpers ─────────────────────────────────────────────

/**
 * The authored-record shape surfaced in the export payload. `created_at` /
 * `updated_at` / `id` are system columns — they become dedicated payload keys,
 * not part of `fields`.
 */
interface AuthoredRecord {
  readonly tableSlug: string
  readonly recordId: string
  readonly fields: Record<string, unknown>
  readonly createdAt: string
  readonly updatedAt: string
}

/**
 * Shape one raw authored-record row into the export contract entry. Splits the
 * system columns (`id`, `created_at`, `updated_at`) out of `fields` and coerces
 * the two timestamps to ISO 8601 — preserved verbatim from the former route.
 */
function shapeAuthoredRecord(
  tableName: string,
  row: Readonly<Record<string, unknown>>
): AuthoredRecord {
  const recordId = row['id']
  const createdAt = row['created_at']
  const updatedAt = row['updated_at']
  const fields = Object.fromEntries(
    Object.entries(row).filter(
      ([key]) => key !== 'id' && key !== 'created_at' && key !== 'updated_at'
    )
  )
  return {
    tableSlug: tableName,
    recordId: String(recordId),
    fields,
    createdAt: new Date(String(createdAt)).toISOString(),
    updatedAt: new Date(String(updatedAt ?? createdAt)).toISOString(),
  }
}

/**
 * The form-submission shape surfaced in the export payload.
 *
 * `submitterIpHash` is deliberately absent — the raw IP never reaches this
 * layer and the digest is an unstable correlation token, so it is neither
 * intelligible (Art. 15) nor portable (Art. 20). See the API contract in
 * `domain/models/api/account/account.ts` for the full reasoning.
 */
interface ExportedFormSubmission {
  readonly submissionId: string
  readonly formName: string | null
  readonly status: string | null
  readonly data: Record<string, unknown>
  readonly userAgent: string | null
  readonly submittedAt: string
}

/**
 * Shape one raw ledger row into the export contract entry: rename `id` to the
 * unambiguous `submissionId`, coerce `submitted_at` to ISO 8601, and default a
 * SQL-`NULL` payload to an empty object (the column is nullable because the
 * ledger also stores share-link submissions, which write `submitted_data`).
 */
function shapeFormSubmission(row: Readonly<AccountFormSubmissionRow>): ExportedFormSubmission {
  return {
    submissionId: row.id,
    formName: row.formName,
    status: row.status,
    data: (row.data ?? {}) as Record<string, unknown>,
    userAgent: row.userAgent,
    submittedAt: new Date(row.submittedAt).toISOString(),
  }
}

/** Coerce a Better Auth `role` value into the export contract enum. */
function normalizeRole(role: string | null): 'admin' | 'member' | 'viewer' {
  if (role === 'viewer') return 'viewer'
  return isAdminRole(role ?? undefined) ? 'admin' : 'member'
}

/** The caller's rows, gathered before the export payload is assembled. */
interface ExportSources {
  readonly user: AccountUserRow
  readonly sessionRows: readonly AccountSessionRow[]
  readonly accountRows: readonly AccountLinkedRow[]
  readonly authoredRecords: readonly AuthoredRecord[]
  readonly formSubmissions: readonly ExportedFormSubmission[]
}

/** Assemble the export payload from the caller's rows. Pure shaping logic. */
function buildExportPayload(sources: Readonly<ExportSources>) {
  const { user, sessionRows, accountRows, authoredRecords, formSubmissions } = sources
  return {
    exportedAt: new Date().toISOString(),
    format: 'json' as const,
    schemaVersion: '1.0' as const,
    profile: {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      // The account's own interface-language preference. It belongs on the
      // export because this section IS the caller's `auth.user` row, and the
      // access right covers the row rather than a chosen subset of it.
      language: user.language,
      // Coerce to a real boolean: the SQLite runtime stores booleans as INTEGER
      // 0/1, and the hand-written raw SELECT in the repository bypasses Drizzle's
      // `{ mode: 'boolean' }` column decoding, so `emailVerified` arrives as a
      // number on SQLite. `Boolean(...)` is idempotent for the Postgres boolean,
      // so this is safe on both dialects (without it the Zod contract rejects the
      // numeric value and the export 500s on the zero-config SQLite default).
      emailVerified: Boolean(user.emailVerified),
      role: normalizeRole(user.role),
      createdAt: new Date(user.createdAt).toISOString(),
      updatedAt: new Date(user.updatedAt).toISOString(),
    },
    sessions: sessionRows.map((s) => ({
      id: s.id,
      userId: s.userId,
      expiresAt: new Date(s.expiresAt).toISOString(),
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      createdAt: new Date(s.createdAt).toISOString(),
      updatedAt: new Date(s.updatedAt).toISOString(),
    })),
    accounts: accountRows.map((a) => ({
      id: a.id,
      userId: a.userId,
      providerId: a.providerId,
      accountId: a.accountId,
      scope: a.scope,
      createdAt: new Date(a.createdAt).toISOString(),
      updatedAt: new Date(a.updatedAt).toISOString(),
    })),
    authoredRecords,
    formSubmissions,
  }
}

// ─── Export use case ─────────────────────────────────────────────────────────

/** Outcome of {@link ExportAccount}. */
export type ExportAccountOutcome =
  | { readonly _tag: 'Ok'; readonly body: typeof accountExportResponseSchema.Type }
  | { readonly _tag: 'Unauthorized' }

/**
 * Build the GDPR export payload for the caller.
 *
 * The user id comes only from the session (resolved by the route) — there is no
 * `:userId` param, so a cross-account export is impossible by construction. A
 * `userId` with no matching `auth.user` row yields `Unauthorized` (the route
 * maps it to a 401, exactly as the former handler did).
 *
 * Authored records are collected by discovering which of each table's CANDIDATE
 * authorship columns is real (dialect-aware introspection in the repository),
 * then scanning each one for `<column> = userId`. The candidates are resolved
 * from the declared `created-by` field TYPES, not assumed to be the literal
 * `created_by` — a config naming that field `author` previously matched no
 * table at all and the export answered `authoredRecords: []` with a 200,
 * telling the caller they had authored nothing. Form submissions are collected
 * from the `system.form_submissions` ledger scoped to `submitter_user_id =
 * userId`, so another user's submissions never leak in and an anonymous
 * (ownerless) submission is never adopted. The assembled payload is
 * validated against the Zod response contract before returning
 * (defence-in-depth — a `.parse` throw becomes a defect → the route's 500).
 */
export const ExportAccount = (
  userId: string,
  tables: readonly AuthoredTableCandidate[]
): Effect.Effect<ExportAccountOutcome, AccountDatabaseError, AccountRepository> =>
  Effect.gen(function* () {
    const repo = yield* AccountRepository

    const user = yield* repo.loadProfile(userId)
    if (user === undefined) {
      return { _tag: 'Unauthorized' } as const
    }

    const [sessionRows, accountRows, submissionRows] = yield* Effect.all([
      repo.loadSessions(userId),
      repo.loadAccounts(userId),
      repo.loadFormSubmissions(userId),
    ])

    const recordTables = yield* repo.tablesWithCreatedBy(tables)
    const perTable = yield* Effect.all(
      recordTables.map(({ tableName, column }) =>
        repo
          .readAuthoredRecords(tableName, column, userId)
          .pipe(Effect.map((rows) => rows.map((row) => shapeAuthoredRecord(tableName, row))))
      ),
      { concurrency: SHARED_POOL_FANOUT_CONCURRENCY }
    )
    const authoredRecords = perTable.flat()

    // Validate against the contract before returning (defence-in-depth).
    const body = decodeOrThrow(accountExportResponseSchema)(
      buildExportPayload({
        user,
        sessionRows,
        accountRows,
        authoredRecords,
        formSubmissions: submissionRows.map(shapeFormSubmission),
      })
    )
    return { _tag: 'Ok', body } as const
  }).pipe(Effect.withSpan('account.export-account'))

// ─── Account-deletion use cases ──────────────────────────────────────────────

/** Result of {@link ScheduleAccountDeletion} — drives the route's 202 body + audit emit. */
export interface ScheduleAccountDeletionResult {
  readonly body: typeof accountDeleteScheduledResponseSchema.Type
  readonly scheduledErasureAt: Date
}

/**
 * Schedule the caller's account for erasure `GRACE_PERIOD_DAYS` out.
 *
 * Delegates the transactional write (set `scheduledErasureAt` + revoke all
 * sessions) to the repository, then validates + returns the scheduled response
 * body. The route emits the `account.deletion.scheduled` audit entry after this
 * succeeds (best-effort, matching the former handler).
 */
export const ScheduleAccountDeletion = (
  userId: string
): Effect.Effect<ScheduleAccountDeletionResult, AccountDatabaseError, AccountRepository> =>
  Effect.gen(function* () {
    const repo = yield* AccountRepository

    const scheduledErasureAt = new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000)
    yield* repo.scheduleErasure(userId, scheduledErasureAt)

    const body = decodeOrThrow(accountDeleteScheduledResponseSchema)({
      status: 'scheduled',
      scheduledErasureAt: scheduledErasureAt.toISOString(),
      gracePeriodDays: GRACE_PERIOD_DAYS,
      cancellable: true,
    })
    return { body, scheduledErasureAt }
  }).pipe(Effect.withSpan('account.schedule-account-deletion'))

/**
 * Cancel a pending erasure for the caller. Clears `scheduledErasureAt` and
 * returns the cancelled response body.
 */
export const CancelAccountDeletion = (
  userId: string
): Effect.Effect<
  typeof accountDeleteCancelledResponseSchema.Type,
  AccountDatabaseError,
  AccountRepository
> =>
  Effect.gen(function* () {
    const repo = yield* AccountRepository
    yield* repo.cancelErasure(userId)
    return decodeOrThrow(accountDeleteCancelledResponseSchema)({ status: 'cancelled' })
  }).pipe(Effect.withSpan('account.cancel-account-deletion'))

// ─── Pending-erasure read use case ───────────────────────────────────────────

/**
 * Read the caller's OWN pending erasure as a `{ items }` rows envelope (backs the
 * session-bound `GET /api/account/pending-erasure`).
 *
 * The `auth.user` row stores only `scheduledErasureAt`; there is no separate
 * request-timestamp column. So while an erasure is pending the read derives
 * `requestedAt = scheduledErasureAt − gracePeriodDays` (the schedule write always
 * sets `scheduledErasureAt = requestedAt + GRACE_PERIOD_DAYS`) and emits exactly
 * one item; when nothing is scheduled it emits an empty `items` array (so a bound
 * data-table clears its row after a cancel). The body is validated against the
 * Zod response contract before returning (defence-in-depth — a `.parse` throw
 * becomes a defect → the route's 500). There is no `userId` path param, so the
 * read is session-scoped with no enumeration surface (the route 401s an anon
 * caller before this runs).
 *
 * The emitted item also carries the caller's OWN `email`, read via the existing
 * dialect-safe `loadProfile` `auth.user` projection (the same read the GDPR export
 * uses on both Postgres and SQLite) — surfacing it is session-bound, not a PII
 * leak, and lets the pending-erasure data-table render whose account is on its way
 * out. The email read is deferred until an item is actually emitted (no extra read
 * on the empty path).
 */
export const LoadPendingErasure = (
  userId: string
): Effect.Effect<
  typeof accountPendingErasureResponseSchema.Type,
  AccountDatabaseError,
  AccountRepository
> =>
  Effect.gen(function* () {
    const repo = yield* AccountRepository
    const scheduledAt = yield* repo.loadScheduledErasure(userId)
    if (scheduledAt === undefined) {
      return decodeOrThrow(accountPendingErasureResponseSchema)({ items: [] })
    }
    // Reuse the existing dialect-safe `auth.user` read for the caller's email.
    // A defined `scheduledAt` proves the row exists, but guard `undefined`
    // defensively (a row vanishing between reads surfaces no item, never a 500).
    const user = yield* repo.loadProfile(userId)
    if (user === undefined) {
      return decodeOrThrow(accountPendingErasureResponseSchema)({ items: [] })
    }
    const requestedAt = new Date(scheduledAt.getTime() - GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000)
    return decodeOrThrow(accountPendingErasureResponseSchema)({
      items: [
        {
          id: userId,
          email: user.email,
          scheduledErasureAt: scheduledAt.toISOString(),
          requestedAt: requestedAt.toISOString(),
          gracePeriodDays: GRACE_PERIOD_DAYS,
        },
      ],
    })
  }).pipe(Effect.withSpan('account.load-pending-erasure'))
