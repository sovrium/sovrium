/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

/**
 * Account Repository Port
 *
 * Type-safe data access backing the two authenticated GDPR endpoints handled by
 * `chainAccountRoutes`:
 *
 *   - `GET  /api/account/export` (GDPR Art. 15 + 20) → the three auth-table
 *     reads ({@link loadProfile} / {@link loadSessions} / {@link loadAccounts})
 *     plus the authored-record collection ({@link tablesWithCreatedBy} +
 *     {@link readAuthoredRecords}) and the caller's form-submission ledger rows
 *     ({@link loadFormSubmissions}).
 *   - `POST /api/account/delete` (GDPR Art. 17) → {@link cancelErasure} and the
 *     transactional {@link scheduleErasure}.
 *
 * The `purge-due` hard-delete sweep is NOT modelled here — it already lives in
 * the infrastructure layer (`purgeDueAccounts` in `account-purge.ts`) and is a
 * token-gated HTTP trigger; the route calls it directly.
 *
 * Note on `tablesWithCreatedBy`: the implementation is POSTGRES-ONLY — it reads
 * `information_schema.columns` to discover which dynamic app tables carry a
 * `created_by` column. That behaviour is preserved verbatim from the former
 * route (no SQLite support is added — out of scope for this extraction).
 *
 * The row types below are defined here (decoupled from Drizzle) so the
 * application layer stays free of an infrastructure dependency. The export
 * payload shaping (id/created_at/updated_at split, ISO coercion, role
 * normalization) is pure logic and lives in the use case
 * (`application/use-cases/account.ts`). Implementation lives in the
 * infrastructure layer (account-repository-live.ts).
 */

/**
 * Database error for account read / mutation operations.
 */
export class AccountDatabaseError extends Data.TaggedError('AccountDatabaseError')<{
  readonly cause: unknown
}> {}

/**
 * The caller's `auth.user` row. Secret material is never selected. Timestamps
 * stay dialect-native (`Date`); the use case owns ISO normalization.
 */
export interface AccountUserRow {
  readonly id: string
  readonly email: string
  readonly name: string | null
  readonly image: string | null
  readonly emailVerified: boolean
  readonly role: string | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

/**
 * One `auth.session` row belonging to the caller. The session token is
 * deliberately NOT selected.
 */
export interface AccountSessionRow {
  readonly id: string
  readonly userId: string
  readonly expiresAt: Date
  readonly ipAddress: string | null
  readonly userAgent: string | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

/**
 * One `auth.account` row (OAuth provider / credential record). Secret material
 * (`password`, `accessToken`, `refreshToken`, `idToken`) is deliberately NOT
 * selected — exporting credentials is a security risk.
 */
export interface AccountLinkedRow {
  readonly id: string
  readonly userId: string
  readonly providerId: string
  readonly accountId: string
  readonly scope: string | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

/**
 * One `system.form_submissions` row submitted by the caller.
 *
 * `submitter_ip_hash` is deliberately NOT selected — the raw IP never reaches
 * the application layer and the digest is an unstable correlation token, so it
 * is not exportable personal data (see the API contract for the full reasoning).
 * Timestamps stay dialect-native (`Date`); the use case owns ISO normalization.
 */
export interface AccountFormSubmissionRow {
  readonly id: string
  readonly formName: string | null
  readonly status: string | null
  readonly data: unknown
  readonly userAgent: string | null
  readonly submittedAt: Date
}

export class AccountRepository extends Context.Tag('AccountRepository')<
  AccountRepository,
  {
    /**
     * Load the caller's `auth.user` row. Returns `undefined` when the id has no
     * matching row (the route maps that to a 401 — the session pointed at a
     * deleted user).
     */
    readonly loadProfile: (
      userId: string
    ) => Effect.Effect<AccountUserRow | undefined, AccountDatabaseError>

    /** Load every `auth.session` row belonging to the caller. */
    readonly loadSessions: (
      userId: string
    ) => Effect.Effect<readonly AccountSessionRow[], AccountDatabaseError>

    /** Load every `auth.account` (linked-account) row belonging to the caller. */
    readonly loadAccounts: (
      userId: string
    ) => Effect.Effect<readonly AccountLinkedRow[], AccountDatabaseError>

    /**
     * Load every form submission the caller made — the `system.form_submissions`
     * rows whose `submitter_user_id` equals `userId`.
     *
     * Scoped by submitter, so another user's submissions can never surface and
     * an anonymous (ownerless) submission is never adopted. Soft-deleted rows
     * are deliberately NOT filtered out: the row is still retained personal
     * data, so Art. 15 reaches it — the same reasoning that leaves
     * {@link readAuthoredRecords} unfiltered.
     */
    readonly loadFormSubmissions: (
      userId: string
    ) => Effect.Effect<readonly AccountFormSubmissionRow[], AccountDatabaseError>

    /**
     * Read the caller's pending scheduled-erasure instant, or `undefined` when
     * none is pending (`scheduledErasureAt` is SQL `NULL`). Backs the
     * session-bound `GET /api/account/pending-erasure` read.
     *
     * Dialect-safe: the raw `scheduledErasureAt` column value arrives as a `Date`
     * (Postgres `timestamptz`), a `number` (SQLite integer `timestamp_ms`), or a
     * SQL `NULL` — the implementation normalizes all of them into a
     * `Date | undefined`.
     */
    readonly loadScheduledErasure: (
      userId: string
    ) => Effect.Effect<Date | undefined, AccountDatabaseError>

    /**
     * Discover which of `tableNames` actually carry a `created_by` column.
     *
     * POSTGRES-ONLY introspection over `information_schema.columns` (preserved
     * verbatim from the former route). Names are sanitized + de-duped inside the
     * implementation before interpolation.
     */
    readonly tablesWithCreatedBy: (
      tableNames: readonly string[]
    ) => Effect.Effect<readonly string[], AccountDatabaseError>

    /**
     * Read every row in `tableName` authored by `userId` (dynamic
     * `created_by = userId` scan via quoted `sql.identifier`). Returns the raw
     * rows; the use case performs the id/created_at/updated_at split + ISO
     * coercion that shapes them into the export payload.
     */
    readonly readAuthoredRecords: (
      tableName: string,
      userId: string
    ) => Effect.Effect<readonly Record<string, unknown>[], AccountDatabaseError>

    /**
     * Clear a pending scheduled erasure for the caller (`scheduledErasureAt`
     * set to SQL `NULL`). Backs `POST /api/account/delete` with `{ cancel:
     * true }`.
     */
    readonly cancelErasure: (userId: string) => Effect.Effect<void, AccountDatabaseError>

    /**
     * Schedule the caller's erasure in a single transaction: set
     * `scheduledErasureAt` to `scheduledAt` AND revoke (DELETE) every one of the
     * caller's sessions. Backs `POST /api/account/delete` with `{ confirm:
     * true }`. The transactional boundary, operations, and order are preserved
     * verbatim from the former route.
     */
    readonly scheduleErasure: (
      userId: string,
      scheduledAt: Date
    ) => Effect.Effect<void, AccountDatabaseError>
  }
>() {}
