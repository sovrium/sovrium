/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import { sanitizeTableName } from '@/domain/utils/database/table-naming'
import { appendAuditEntryToDbTx } from '@/infrastructure/audit-log/drizzle-store'
import { db } from '@/infrastructure/database'
import { AUTHORSHIP_FIELDS } from '@/infrastructure/database/table-queries/mutation-helpers/authorship-helpers'
import { logInfo } from '@/infrastructure/logging/logger'
import { nowEpochMsSqlLiteral } from './sql/dialect-ddl'
import { executeRaw, type RawSqlRunner } from './sql/dialect-execute'
import { getExistingColumnNames, systemTableExists } from './sql/dialect-introspection'
import { authTableRef, systemTableRef } from './sql/dialect-sql'
import type { AuditLogEntry } from '@/domain/models/api/admin/audit-log/entry'
import type { DrizzleTransaction } from '@/infrastructure/database'

/**
 * GDPR Art. 17 hard-delete purge path.
 *
 * `purgeAccount` PHYSICALLY removes (`DELETE FROM`, never a `deleted_at`
 * tombstone) every personal-data row belonging to a user, in one
 * transaction, in FK-safe order (children before parent). The purge
 * scheduler (`purgeDueAccounts`) finds users whose erasure grace window
 * has elapsed and purges each of them.
 *
 * GDPR erasure is part of the core feature subset — it MUST work on both the
 * PostgreSQL and SQLite runtimes. This module is therefore dialect-agnostic:
 *
 *   - Raw SQL is run through `executeRaw` (`.execute()` on Postgres,
 *     `.all()` on SQLite), not the Postgres-only `tx.execute()`.
 *   - Column introspection uses `getExistingColumnNames` (`information_schema`
 *     on Postgres, `pragma_table_info` on SQLite).
 *   - Auth tables are referenced via `authTableRef` (`auth.user` on Postgres,
 *     `auth_user` on SQLite — SQLite has no schemas).
 *   - The "now" comparison uses `nowEpochMsSqlLiteral` (`NOW()` on Postgres vs an
 *     epoch-ms INTEGER on SQLite) so it matches the `scheduledErasureAt` storage
 *     shape on each dialect (Postgres `timestamptz` / SQLite `timestamp_ms`).
 *
 * App-table names are passed in by the caller (they are derived from the
 * validated `app.tables[]` config) and are sanitized again here as a
 * defence-in-depth measure before interpolation into raw SQL.
 */

/**
 * The authorship stamps that record an act performed ON a record rather than
 * authorship OF it — and which are therefore SHED rather than swept.
 *
 * `created_by` is the opposite case and is handled separately: a record the user
 * authored is their content, so the record itself is deleted. `updated_by` and
 * `deleted_by` stamp somebody else's record — by construction, since a record
 * the erased user authored has already been removed by the `created_by` step. To
 * delete a record because the erased user once edited it would destroy another
 * author's work in the name of the editor's privacy, which is over-deletion, not
 * erasure. So the identifier goes and the record stays, exactly as the
 * `ON DELETE SET NULL` on `record_comments.moderated_by` already decides for
 * moderating another user's comment.
 *
 * Both columns are nullable bare `TEXT` — the foreign key that would have
 * carried a referential action is not generated (blocked on issue #3980) — so
 * nothing cascades and nothing names them but this list.
 */
const SHED_AUTHORSHIP_FIELDS = [AUTHORSHIP_FIELDS.UPDATED_BY, AUTHORSHIP_FIELDS.DELETED_BY] as const

/**
 * Map each app table to whichever authorship columns it actually carries.
 * Tables with none cannot reference the user through authorship at all.
 *
 * One introspection pass answers for all three columns, because the sweep needs
 * a different verdict per column on the same table (delete on `created_by`, shed
 * on the other two) and probing three times would triple the round trips.
 *
 * Dialect-aware introspection: `getExistingColumnNames` queries
 * `information_schema` on Postgres and `pragma_table_info` on SQLite.
 */
async function authorshipColumnsByTable(
  tx: Readonly<DrizzleTransaction>,
  tableNames: readonly string[]
): Promise<ReadonlyMap<string, ReadonlySet<string>>> {
  if (tableNames.length === 0) return new Map()

  const sanitized = [...new Set(tableNames.map(sanitizeTableName))].filter(
    (name) => name.length > 0
  )
  if (sanitized.length === 0) return new Map()

  // The transaction handle drives `getExistingColumnNames` as a `RawSqlRunner`
  // — it carries `execute()` (Postgres) or `all()` (SQLite); the helper picks
  // whichever the active dialect needs.
  const runner = tx as unknown as RawSqlRunner
  const probed = await Promise.all(
    sanitized.map(async (name) => {
      const columns = await getExistingColumnNames(runner, name, [
        AUTHORSHIP_FIELDS.CREATED_BY,
        ...SHED_AUTHORSHIP_FIELDS,
      ])
      return [name, columns] as const
    })
  )
  return new Map(probed.filter(([, columns]) => columns.size > 0))
}

/**
 * The config-gated `system` tables whose every row is wholly the erased user's
 * own, keyed by a bare `user_id` TEXT column with no foreign key on either
 * dialect ("FK in spirit").
 *
 * Both are deleted OUTRIGHT rather than orphaned, because in both the user id is
 * not an attribute of the row — it is the whole subject of it. A read-state
 * watermark is `(user_id, table_id, record_id, last_read_at)`: strip the user and
 * nothing meaningful is left, and `user_id` is `NOT NULL` and part of the unique
 * index the mark-read upsert conflicts on, so orphaning is not even available. A
 * row-level grant says "this person may see these records": a grant to nobody is
 * not a retained fact, it is a dangling authorization.
 *
 * Neither is given a real foreign key instead. A cascade would delete the same
 * rows while being INVISIBLE to the enumeration in {@link purgeAccount} — the
 * exact failure mode that let `form_submissions` survive erasure for so long. The
 * list is what an operator reads to answer "what does erasure delete?", so the
 * deletion belongs in the list.
 *
 * Both tables are only materialized when the app opts into the owning feature
 * (`auth.scopeTables` / `comments.readTracking`), so each is probed for
 * existence first: an unconditional `DELETE FROM` against a table this app never
 * created would abort the transaction and take the whole erasure down with it.
 */
const USER_OWNED_GATED_SYSTEM_TABLES = ['comment_read_state', 'user_access'] as const

/**
 * Delete the erased user's rows from the config-gated, user-owned `system`
 * tables that exist in this database.
 *
 * @param tx - the open erasure transaction.
 * @param userId - the user being erased.
 */
async function deleteUserOwnedGatedSystemRows(
  tx: Readonly<DrizzleTransaction>,
  userId: string
): Promise<void> {
  const runner = tx as unknown as RawSqlRunner

  // eslint-disable-next-line functional/no-loop-statements -- sequential DELETEs inside one transaction
  for (const tableName of USER_OWNED_GATED_SYSTEM_TABLES) {
    if (await systemTableExists(runner, tableName)) {
      // eslint-disable-next-line functional/no-expression-statements -- DB side effect
      await executeRaw(tx, sql`DELETE FROM ${systemTableRef(tableName)} WHERE user_id = ${userId}`)
    }
  }
}

/**
 * Sweep the app tables' authorship columns, with a different verdict per column.
 *
 * `created_by` DELETES the record: it says the record IS the user's content.
 * `updated_by` / `deleted_by` only NULL the stamp: they say the user acted ON a
 * record that — by construction, since the `created_by` pass has already run —
 * belongs to somebody else. See {@link SHED_AUTHORSHIP_FIELDS}.
 *
 * The delete runs first on each table so the shed only ever touches the
 * survivors, and each table is handled in full before the next so a table
 * carrying all three columns is never left half-swept.
 *
 * @param tx - the open erasure transaction.
 * @param userId - the user being erased.
 * @param appTableNames - app table names to scan for authorship columns.
 */
async function sweepAppTableAuthorship(
  tx: Readonly<DrizzleTransaction>,
  userId: string,
  appTableNames: readonly string[]
): Promise<void> {
  const authorshipTables = await authorshipColumnsByTable(tx, appTableNames)

  // eslint-disable-next-line functional/no-loop-statements -- sequential writes inside one transaction
  for (const [tableName, columns] of authorshipTables) {
    if (columns.has(AUTHORSHIP_FIELDS.CREATED_BY)) {
      // eslint-disable-next-line functional/no-expression-statements -- DB side effect
      await executeRaw(
        tx,
        sql`DELETE FROM ${sql.identifier(tableName)} WHERE ${sql.identifier(AUTHORSHIP_FIELDS.CREATED_BY)} = ${userId}`
      )
    }

    // eslint-disable-next-line functional/no-loop-statements -- sequential UPDATEs inside one transaction
    for (const column of SHED_AUTHORSHIP_FIELDS) {
      if (!columns.has(column)) continue
      // eslint-disable-next-line functional/no-expression-statements -- DB side effect
      await executeRaw(
        tx,
        sql`UPDATE ${sql.identifier(tableName)} SET ${sql.identifier(column)} = NULL WHERE ${sql.identifier(column)} = ${userId}`
      )
    }
  }
}

/**
 * Shed the erased user's identifier from the grants they ISSUED to other people.
 *
 * `system.user_access` carries two user columns and they get opposite verdicts.
 * `user_id` is the GRANTEE — the row is wholly theirs, so it is deleted with the
 * rest of {@link USER_OWNED_GATED_SYSTEM_TABLES}. `created_by` is the ISSUER, a
 * second bare `TEXT` column with no foreign key on either dialect, recording who
 * handed the grant out. Deleting on that column would revoke a THIRD PARTY's
 * live access because the issuer left — over-deletion in the name of erasure.
 * The identifier is removed and the authorization stands.
 *
 * Config-gated like the deletes above, so the table is probed first: an
 * unconditional `UPDATE` against a table this app never created would abort the
 * transaction and take the whole erasure down with it.
 *
 * @param tx - the open erasure transaction.
 * @param userId - the user being erased.
 */
async function shedGrantIssuerIdentifier(
  tx: Readonly<DrizzleTransaction>,
  userId: string
): Promise<void> {
  const runner = tx as unknown as RawSqlRunner
  if (!(await systemTableExists(runner, 'user_access'))) return

  // eslint-disable-next-line functional/no-expression-statements -- DB side effect
  await executeRaw(
    tx,
    sql`UPDATE ${systemTableRef('user_access')} SET created_by = NULL WHERE created_by = ${userId}`
  )
}

/**
 * Delete the erased user's rows from the AI-interaction activity feed.
 *
 * `system.ai_activity_logs` names the acting person TWICE, in two bare `TEXT`
 * columns with no foreign key on either dialect:
 *
 *   - `user_email` — the address, written on mutation turns.
 *   - `actor_name` — the raw USER ID on a plain chat turn (the chat route builds
 *     it as `session?.userId`), the address on a mutation turn.
 *
 * Both are matched, because clearing only the email would leave every plain-turn
 * row still naming the person by id.
 *
 * These rows are DELETED rather than shed, unlike the two authorship stamps
 * above, for two reasons. `actor_name` is `NOT NULL`, so there is nothing to shed
 * it to short of overwriting it with an invented placeholder — fabricating
 * attribution rather than removing it. And what survives the removal is
 * `('user', ?, 'ai.chat.mutation', 'contacts', T)`: somebody, at some point, did
 * something. That is the `comment_read_state` shape — strip the user and nothing
 * meaningful is left — not the shape of a record that belongs to anybody else.
 *
 * Scoped to `actor_type = 'user'` so agent-initiated rows, whose `actor_name` is
 * the agent's name, can never be swept by an id or address that happens to
 * collide with one.
 *
 * @param tx - the open erasure transaction.
 * @param userId - the user being erased.
 * @param erasedEmail - their email, captured before the user row is deleted.
 */
async function deleteAiActivityRows(
  tx: Readonly<DrizzleTransaction>,
  userId: string,
  erasedEmail: string | undefined
): Promise<void> {
  // eslint-disable-next-line functional/no-expression-statements -- DB side effect
  await executeRaw(
    tx,
    sql`DELETE FROM ${systemTableRef('ai_activity_logs')}
        WHERE actor_type = 'user' AND actor_name = ${userId}`
  )

  // Matched as a separate statement rather than one `OR`-ed predicate so a user
  // whose email could not be read is never turned into an empty-string match.
  if (erasedEmail === undefined) return
  // eslint-disable-next-line functional/no-expression-statements -- DB side effect
  await executeRaw(
    tx,
    sql`DELETE FROM ${systemTableRef('ai_activity_logs')}
        WHERE actor_type = 'user' AND (actor_name = ${erasedEmail} OR user_email = ${erasedEmail})`
  )
}

/**
 * Build the `account.deletion.purged` audit entry for an erasure.
 *
 * The actor is the SWEEP, not the person swept. `POST /api/account/purge-due` is
 * gated by an internal scheduler token rather than a session, so nobody is
 * logged in when this entry is written — it is exactly the "background job,
 * scheduled archival" case the `system` actor type is defined for. The human
 * attribution for the erasure already exists on the `account.deletion.scheduled`
 * entry written at request time, with the user as actor; repeating it here would
 * name the erased person as the author of the job that erased them.
 *
 * The entry previously wrote `type: 'user'` with `role: 'system'`, which is the
 * one pair the actor contract forbids: `actorRoleSchema` defines `system` as the
 * NON-HUMAN sentinel and says it is "never valid for a `type: 'user'` actor".
 * Correcting the TYPE rather than the role is what makes the pair consistent
 * here, because the sweep really is non-human.
 *
 * Nothing about the erased user is lost. They are the `resource` the sweep acted
 * upon, and the metadata carries `erasedUserId` + `erasedEmail` so operators can
 * still answer "who was erased?" via `metadata->>'erasedEmail'`
 *. `actor.id` is `null` because system actors have no
 * user identity — which is where the old shape ended up regardless, since the
 * `actor_id` FK's `ON DELETE SET NULL` null-ified it on commit one statement
 * later. The email is likewise kept OUT of the actor block: `actor_email` is
 * never cleared by erasure, so putting it there would have retained the address
 * in a column nothing sweeps, on top of the copy the metadata deliberately keeps.
 *
 * @param userId - The user being erased.
 * @param erasedEmail - Their email, captured before the user row is deleted.
 */
function buildPurgeAuditEntry(
  userId: string,
  erasedEmail: string | undefined
): Readonly<AuditLogEntry> {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    action: AUDIT_ACTIONS.ACCOUNT_DELETION_PURGED,
    actor: {
      // eslint-disable-next-line unicorn/no-null -- the actor contract is `null` for system actors (nullable FK column)
      id: null,
      type: 'system',
      role: 'system',
    },
    resource: { type: 'user', id: userId },
    severity: 'critical',
    result: 'success',
    // The transport field is first-class on every audit entry. The purge
    // completes a deletion requested through the REST API, so it audits as
    // `api` (the transport enum is config-mutation-oriented; `api` is the
    // sensible canal for an API-initiated account lifecycle event).
    transport: 'api',
    metadata: {
      erasedUserId: userId,
      ...(erasedEmail ? { erasedEmail } : {}),
    },
  }
}

/**
 * Physically delete every personal-data row owned by `userId`.
 *
 * Deletion order (FK-safe — children before the `auth.user` parent), with the
 * audit-event insert interleaved so the row's `actor_id` FK is valid at
 * insert time (the parent user row has not yet been deleted) and is
 * null-ified on transaction commit by the FK's `ON DELETE SET NULL`:
 *
 *   1. App-table records where `created_by = userId`, then `updated_by` /
 *      `deleted_by` NULL-ified on whatever survived (another author's records —
 *      see {@link SHED_AUTHORSHIP_FIELDS})
 *   2. `system.form_submissions` rows where `submitter_user_id = userId`
 *   3. `system.record_comments` rows where `user_id = userId`
 *   4. `system.comment_read_state` + `system.user_access` rows where
 *      `user_id = userId` (both config-gated — see
 *      {@link USER_OWNED_GATED_SYSTEM_TABLES}); then `user_access.created_by`
 *      NULL-ified on the grants the user ISSUED to other people
 *      ({@link shedGrantIssuerIdentifier}); then the `system.ai_activity_logs`
 *      rows naming the user by id or address ({@link deleteAiActivityRows})
 *   5. `system._admin_search_index` — the operator-search projection of the user
 *   6. `auth.verification` rows (matched by the user's email identifier)
 *   7. `auth.two_factor` rows
 *   8. `auth.session` rows
 *   9. `auth.account` rows
 *  10. INSERT the `account.deletion.purged` audit entry. Its actor is the
 *      non-human sweep, so `actor_id` is NULL from the start; the metadata
 *      captures `erasedUserId` + `erasedEmail` so the audit trail can still
 * answer "who was erased?".
 *  11. the `auth.user` row itself — the FK fires on commit, shedding every
 *      remaining `actor_id` and `type: 'user'` assignment, while the purge
 *      entry remains queryable via `metadata->>'erasedEmail'`.
 *
 * App-table columns of `type: 'user'` are NOT swept here: those carry a generated
 * foreign key with `ON DELETE SET NULL`, so step 11 sheds the identifier and
 * leaves the record — which may belong to another author — intact.
 *
 * Every table holding the user's personal data is named EXPLICITLY here, even
 * where a foreign key would already cascade. `system.record_comments` is the
 * cautionary case that motivated the rule: its `user_id` carries
 * `ON DELETE CASCADE`, so comments were erased for a long time without this
 * function ever mentioning them — which meant the enumeration silently
 * understated what it deletes, and the next table added without a cascade
 * would be erased by nobody. That is exactly how `system.form_submissions`
 * came to survive erasure intact: its `submitter_user_id` is a bare column
 * with no foreign key on either dialect, so nothing cascaded and nothing
 * named it. Adding a cascade would have hidden that row from this list too;
 * naming the table keeps the erasure surface readable in one place. Step 3 is
 * therefore behaviour-NEUTRAL — the cascade already removed the same rows —
 * and exists so the list is the honest answer to "what does erasure delete?".
 *
 * @param userId - The user whose account is being erased.
 * @param appTableNames - App table names to scan for authored records.
 */
export async function purgeAccount(
  userId: string,
  appTableNames: readonly string[]
): Promise<void> {
  // eslint-disable-next-line functional/no-expression-statements -- DB side effect inside a transaction boundary
  await db.transaction(async (tx) => {
    // Capture the email BEFORE deleting the user row — it lands in the
    // audit-event metadata so operators can answer "who was erased?" after
    // the user row is gone (and the audit `actor_id` is null-ified).
    const emailRows = (await executeRaw(
      tx,
      sql`SELECT email FROM ${authTableRef('user')} WHERE id = ${userId}`
    )) as unknown as readonly { email: string }[]
    const erasedEmail = emailRows[0]?.email

    // 1. App-table records authored by the user, then the authorship stamps left
    //    on records authored by SOMEBODY ELSE — two deliberately different
    //    verdicts, see {@link sweepAppTableAuthorship}.
    // eslint-disable-next-line functional/no-expression-statements -- DB side effect
    await sweepAppTableAuthorship(tx, userId, appTableNames)

    // 2. Form-submission ledger rows the user submitted. PHYSICAL delete, not
    //    a `deleted_at` tombstone and not a null-ified `submitter_user_id` —
    //    the submitted body is itself personal data (people disclose addresses
    //    and phone numbers in free-text fields), so orphaning the row would
    //    leave that data in place. Rows with a NULL `submitter_user_id` are
    //    anonymous submissions belonging to nobody and are left untouched.
    // eslint-disable-next-line functional/no-expression-statements -- DB side effect
    await executeRaw(
      tx,
      sql`DELETE FROM ${systemTableRef('form_submissions')} WHERE submitter_user_id = ${userId}`
    )

    // 3. Comments the user authored. BEHAVIOUR-NEUTRAL: `record_comments.user_id`
    //    carries `ON DELETE CASCADE` on both dialects, so step 9 already removes
    //    exactly these rows. Naming the table here is a readability contract, not
    //    a behaviour change — the enumeration in this function is what an operator
    //    reads to answer "what does erasure delete?", and a cascade is invisible
    //    to that reading. `moderated_by` is deliberately NOT matched: moderating
    //    someone else's comment is an act ON another user's content, and its FK
    //    is `ON DELETE SET NULL` (identifier shed, comment retained).
    // eslint-disable-next-line functional/no-expression-statements -- DB side effect
    await executeRaw(
      tx,
      sql`DELETE FROM ${systemTableRef('record_comments')} WHERE user_id = ${userId}`
    )

    // 4. The config-gated, user-owned system rows — the per-user comment
    //    read-state watermark and the row-level access grants. Hard DELETE, and
    //    named here rather than given a cascade, for the reasons set out on
    //    `USER_OWNED_GATED_SYSTEM_TABLES`.
    // eslint-disable-next-line functional/no-expression-statements -- DB side effect
    await deleteUserOwnedGatedSystemRows(tx, userId)

    // 4b. The grants the user ISSUED to other people. Those rows are somebody
    //     else's live authorization, so only the issuer identifier goes.
    // eslint-disable-next-line functional/no-expression-statements -- DB side effect
    await shedGrantIssuerIdentifier(tx, userId)

    // 4c. The AI-interaction activity feed, which names the user by id AND by
    //     address across two bare columns. Hard DELETE — nothing survives the
    //     removal of the actor there.
    // eslint-disable-next-line functional/no-expression-statements -- DB side effect
    await deleteAiActivityRows(tx, userId, erasedEmail)

    // 5. The admin-console search projection of this user. Not a cascade
    //    candidate and not an FK candidate either: `_admin_search_index` is a
    //    DERIVED index, rebuilt by an `INSERT … ON CONFLICT DO UPDATE` upsert
    //    that only ever writes rows for entities that still exist and never
    //    prunes rows whose source is gone — so without this DELETE the row is
    //    permanent. It matters because `title` holds the user's EMAIL, which
    //    makes the leftover row an erased address that stays searchable by every
    //    operator, not merely a stale identifier.
    // eslint-disable-next-line functional/no-expression-statements -- DB side effect
    await executeRaw(
      tx,
      sql`DELETE FROM ${systemTableRef('_admin_search_index')}
          WHERE type = 'user' AND entity_id = ${userId}`
    )

    // 6. Verification rows are keyed by the user's email identifier.
    // eslint-disable-next-line functional/no-expression-statements -- DB side effect
    await executeRaw(
      tx,
      sql`DELETE FROM ${authTableRef('verification')}
          WHERE identifier IN (SELECT email FROM ${authTableRef('user')} WHERE id = ${userId})`
    )

    // 7-9. Direct child rows of auth.user.
    // eslint-disable-next-line functional/no-expression-statements -- DB side effect
    await executeRaw(tx, sql`DELETE FROM ${authTableRef('two_factor')} WHERE user_id = ${userId}`)
    // eslint-disable-next-line functional/no-expression-statements -- DB side effect
    await executeRaw(tx, sql`DELETE FROM ${authTableRef('session')} WHERE user_id = ${userId}`)
    // eslint-disable-next-line functional/no-expression-statements -- DB side effect
    await executeRaw(tx, sql`DELETE FROM ${authTableRef('account')} WHERE user_id = ${userId}`)

    // 10. Insert the audit entry while the user row still exists. The
    //    `actor_id` FK is valid at insert time; on commit the FK fires
    //    when step 11 deletes the user row and null-ifies `actor_id`.
    // eslint-disable-next-line functional/no-expression-statements -- DB side effect inside the open transaction
    await appendAuditEntryToDbTx(tx, buildPurgeAuditEntry(userId, erasedEmail))

    // 11. The parent auth.user row — FK fires on commit, null-ifying actor_id
    //    and shedding every `type: 'user'` assignment on records this user did
    //    not author.
    // eslint-disable-next-line functional/no-expression-statements -- DB side effect
    await executeRaw(tx, sql`DELETE FROM ${authTableRef('user')} WHERE id = ${userId}`)
  })

  logInfo(`[account-purge] Hard-deleted account ${userId}`)
}

/**
 * Run the erasure scheduler: hard-delete every account whose
 * `scheduledErasureAt` is in the past.
 *
 * @param appTableNames - App table names to scan for authored records.
 * @returns The number of accounts purged.
 */
export async function purgeDueAccounts(appTableNames: readonly string[]): Promise<number> {
  const dueRows = (await executeRaw(
    db,
    sql`SELECT id FROM ${authTableRef('user')}
        WHERE "scheduledErasureAt" IS NOT NULL AND "scheduledErasureAt" <= ${sql.raw(nowEpochMsSqlLiteral())}`
  )) as unknown as readonly { id: string }[]

  // eslint-disable-next-line functional/no-loop-statements -- sequential per-account purge
  for (const row of dueRows) {
    // eslint-disable-next-line functional/no-expression-statements -- DB side effect
    await purgeAccount(row.id, appTableNames)
  }

  return dueRows.length
}
