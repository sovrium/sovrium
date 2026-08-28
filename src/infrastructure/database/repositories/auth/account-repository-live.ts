/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { desc, eq, sql } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import {
  AccountDatabaseError,
  AccountRepository,
  type AccountFormSubmissionRow,
  type AccountLinkedRow,
  type AccountSessionRow,
  type AccountUserRow,
  type AuthoredTableCandidate,
  type AuthoredTableColumn,
} from '@/application/ports/repositories/auth/account-repository'
import { sanitizeTableName } from '@/domain/utils/database/table-naming'
import { db } from '@/infrastructure/database'
import {
  authTableRef,
  formSubmissionsTable,
} from '@/infrastructure/database/drizzle/dialect-schema'
import { makeDbWrap, SHARED_POOL_FANOUT_CONCURRENCY } from '@/infrastructure/database/sql/db-effect'
import {
  executeRaw,
  executeRawTyped,
  type RawSqlRunner,
} from '@/infrastructure/database/sql/dialect-execute'
import { getExistingColumnNames } from '@/infrastructure/database/sql/dialect-introspection'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'

/** Wrap a DB promise, adapting failures to AccountDatabaseError. */
const wrap = makeDbWrap((cause) => new AccountDatabaseError({ cause }))

/**
 * Normalize a raw `scheduledErasureAt` cell into a `Date | undefined`.
 *
 * The same logical column is read across two dialects whose raw drivers surface
 * it differently: Postgres `timestamptz` arrives as a `Date` (occasionally a
 * string), while the SQLite `integer('scheduledErasureAt', { mode: 'timestamp_ms' })`
 * column — read here as RAW SQL that bypasses Drizzle's `timestamp_ms` decoder —
 * arrives as a `number` (epoch ms). A SQL `NULL` (no pending erasure), or any
 * unparseable value, degrades to `undefined`. `new Date(value)` handles the
 * numeric-ms / ISO-string cases uniformly; a `Date` passes through verbatim. The
 * return type is left to inference so the explicit-type immutability lint does
 * not flag the inherently-mutable `Date`.
 */
function toOptionalDate(value: unknown) {
  if (value instanceof Date) return value
  if (typeof value === 'number' || typeof value === 'string') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? undefined : date
  }
  return undefined
}

/**
 * Probe ONE table for whichever of its CANDIDATE authorship columns is real,
 * yielding the `(table, column)` pair when one matches.
 *
 * The candidates come from the table's declared `created-by` field TYPES unioned
 * with the literal `created_by`. Probing the literal alone made the export blind
 * to a config that names the field anything else — `authoredRecords` came back
 * empty and the caller was told, with a 200, that they had authored nothing.
 *
 * DIALECT-AWARE introspection: `getExistingColumnNames` queries
 * `information_schema.columns` on Postgres and `pragma_table_info(...)` on
 * SQLite — so the GDPR self-service export works on the zero-config SQLite
 * default, not just Postgres. (The former implementation used a POSTGRES-ONLY
 * `db.execute(sql\`… information_schema …\`)` probe — both `db.execute` and
 * `information_schema` are Postgres-only — which 500'd the export on SQLite.
 * This mirrors the erasure path's `tablesWithCreatedBy` in `account-purge.ts`,
 * which already routes through this helper.)
 */
const probeCreatedByColumn = async (
  runner: Readonly<RawSqlRunner>,
  candidate: Readonly<AuthoredTableCandidate>
): Promise<AuthoredTableColumn | undefined> => {
  const existing = await getExistingColumnNames(runner, candidate.tableName, candidate.columns)
  // Candidate ORDER is the caller's preference order and is preserved: the
  // literal `created_by` is offered first, so a table carrying both it and a
  // custom-named field exports through the literal exactly as it always did.
  const column = candidate.columns.find((name) => existing.has(name))
  return column === undefined ? undefined : { tableName: candidate.tableName, column }
}

/**
 * Find app tables that actually carry a `created_by` column.
 *
 * Names are sanitized + de-duped before introspection as a defence-in-depth
 * measure (the helper also binds the table name as a query parameter).
 *
 * FAN-OUT WIDTH: `SHARED_POOL_FANOUT_CONCURRENCY`. Every probe runs on the `db`
 * facade — the SHARED pool — and this backs the two authenticated GDPR
 * endpoints, so it is a request path. The width is the number of distinct app
 * tables: config-bounded, which is precisely the provenance the 2026-07-25
 * incident had. Each probe is a single cheap catalog lookup, but cheapness caps
 * DURATION, not WIDTH; ten configured tables would still take ten of the ten
 * default pool slots and starve every co-firing request, including the session
 * lookup that authenticated this one.
 *
 * ORDER: `Effect.all` preserves array order exactly as `Promise.all` did, so the
 * returned table list — and therefore the ordering of the export's per-table
 * sections — is unchanged.
 *
 * ERRORS: there is no per-probe guard, so one failing lookup failed the whole
 * call before and still does, surfacing the identical `AccountDatabaseError`
 * with the identical cause. Wrapping moved from one outer `wrap` to one `wrap`
 * per probe, which is the same tagged error either way.
 */
const tablesWithCreatedByEffect = (candidates: readonly AuthoredTableCandidate[]) => {
  // De-duped by sanitized table name via a Map rather than a mutated Set —
  // last-wins, and `Map` preserves insertion order, so the fan-out order (and
  // therefore the ordering of the export's per-table sections) is unchanged.
  const sanitized = [
    ...new Map(
      candidates
        .map((candidate) => ({ ...candidate, tableName: sanitizeTableName(candidate.tableName) }))
        .filter((candidate) => candidate.tableName.length > 0)
        .map((candidate) => [candidate.tableName, candidate] as const)
    ).values(),
  ]

  // The `db` facade drives `getExistingColumnNames` as a `RawSqlRunner` — it
  // carries `execute()` (Postgres) or `all()` (SQLite); the helper picks
  // whichever the active dialect needs (never the Postgres-only `db.execute`).
  const runner = db as unknown as RawSqlRunner
  return Effect.all(
    sanitized.map((candidate) => wrap(() => probeCreatedByColumn(runner, candidate))),
    { concurrency: SHARED_POOL_FANOUT_CONCURRENCY }
  ).pipe(
    Effect.map((matched) =>
      matched.filter((entry): entry is AuthoredTableColumn => entry !== undefined)
    )
  )
}

/**
 * Account Repository Implementation (Drizzle / raw SQL).
 *
 * Backs the two authenticated GDPR endpoints. All projection / ISO-coercion /
 * payload-shaping logic lives in the `account` use case; this layer emits only
 * raw queries. The three auth-table reads omit secret material (session token,
 * password, OAuth tokens) — the projections are preserved verbatim from the
 * former route. The `information_schema` introspection is POSTGRES-ONLY and is
 * unchanged; the schedule-erasure path keeps its original `db.transaction`
 * boundary, operations, and order.
 */
export const AccountRepositoryLive = Layer.succeed(AccountRepository, {
  loadProfile: (userId) =>
    wrap(async () => {
      const userRows = await executeRawTyped<AccountUserRow>(
        db,
        sql`SELECT id, email, name, image, email_verified AS "emailVerified",
                   role, created_at AS "createdAt", updated_at AS "updatedAt"
            FROM ${authTableRef('user')} WHERE id = ${userId}`
      )
      return userRows[0]
    }),

  loadSessions: (userId) =>
    wrap(async () =>
      executeRawTyped<AccountSessionRow>(
        db,
        sql`SELECT id, user_id AS "userId", expires_at AS "expiresAt",
                   ip_address AS "ipAddress", user_agent AS "userAgent",
                   created_at AS "createdAt", updated_at AS "updatedAt"
            FROM ${authTableRef('session')} WHERE user_id = ${userId}`
      )
    ),

  // Secret material (password / accessToken / refreshToken / idToken) is
  // deliberately NOT selected — exporting credentials is a security risk.
  loadAccounts: (userId) =>
    wrap(async () =>
      executeRawTyped<AccountLinkedRow>(
        db,
        sql`SELECT id, user_id AS "userId", provider_id AS "providerId",
                   account_id AS "accountId", scope,
                   created_at AS "createdAt", updated_at AS "updatedAt"
            FROM ${authTableRef('account')} WHERE user_id = ${userId}`
      )
    ),

  // Read through the Drizzle query builder rather than raw SQL so the
  // dialect-correct table object (`system.form_submissions` on Postgres,
  // `system_form_submissions` on SQLite) and the `data` column's JSON decoding
  // (jsonb on Postgres, TEXT `{ mode: 'json' }` on SQLite) both come for free.
  // `submitter_ip_hash` is deliberately NOT selected — see the port docstring.
  loadFormSubmissions: (userId) =>
    wrap(async () => {
      const submissions = formSubmissionsTable()
      return (await db
        .select({
          id: submissions.id,
          formName: submissions.formName,
          status: submissions.status,
          data: submissions.data,
          userAgent: submissions.userAgent,
          submittedAt: submissions.submittedAt,
        })
        .from(submissions)
        .where(eq(submissions.submitterUserId, userId))
        .orderBy(desc(submissions.submittedAt))) as readonly AccountFormSubmissionRow[]
    }),

  loadScheduledErasure: (userId) =>
    wrap(async () => {
      const rows = await executeRawTyped<{ readonly scheduledErasureAt: unknown }>(
        db,
        sql`SELECT "scheduledErasureAt" AS "scheduledErasureAt"
            FROM ${authTableRef('user')} WHERE id = ${userId}`
      )
      return toOptionalDate(rows[0]?.scheduledErasureAt)
    }),

  tablesWithCreatedBy: (candidates) => tablesWithCreatedByEffect(candidates),

  readAuthoredRecords: (tableName, column, userId) =>
    wrap(async () =>
      executeRawTyped<Record<string, unknown>>(
        db,
        sql`SELECT * FROM ${sql.identifier(tableName)} WHERE ${sql.identifier(column)} = ${userId}`
      )
    ),

  cancelErasure: (userId) =>
    wrap(async () => {
      // SQL `NULL` literal clears the pending erasure.
      // eslint-disable-next-line functional/no-expression-statements -- DB side effect
      await executeRaw(
        db,
        sql`UPDATE ${authTableRef('user')} SET "scheduledErasureAt" = NULL WHERE id = ${userId}`
      )
    }),

  scheduleErasure: (userId, scheduledAt) =>
    wrap(async () => {
      // SQLite's `scheduledErasureAt` is an INTEGER `timestamp_ms` column and
      // bun:sqlite silently coerces a bound `Date` to NULL — so persist the
      // epoch-ms number there; Postgres keeps the native `timestamptz` Date.
      // Without this the SQLite erasure schedule wrote NULL, so the pending
      // read never surfaced it and the (integer-ms) purge sweep never matched.
      const scheduledValue = isSqliteRuntime() ? scheduledAt.getTime() : scheduledAt
      // eslint-disable-next-line functional/no-expression-statements -- DB side effect inside transaction
      await db.transaction(async (tx) => {
        // eslint-disable-next-line functional/no-expression-statements -- DB side effect
        await executeRaw(
          tx,
          sql`UPDATE ${authTableRef('user')} SET "scheduledErasureAt" = ${scheduledValue} WHERE id = ${userId}`
        )
        // Revoke ALL of the caller's sessions — the account is on its way out.
        // eslint-disable-next-line functional/no-expression-statements -- DB side effect
        await executeRaw(tx, sql`DELETE FROM ${authTableRef('session')} WHERE user_id = ${userId}`)
      })
    }),
})
