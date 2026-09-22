/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { StorageService } from '@/application/ports/services/storage-service'
import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import { AVATAR_BUCKET_NAME, avatarStorageKeyFromUrl } from '@/domain/models/app/auth/avatar-url'
import {
  createdByFieldNames,
  deletedByFieldNames,
  updatedByFieldNames,
} from '@/domain/models/app/tables/authorship-fields'
import { appendAuditEntryToDbTx } from '@/infrastructure/audit-log/drizzle-store'
import { db } from '@/infrastructure/database'
import { AUTHORSHIP_FIELDS } from '@/infrastructure/database/table-queries/mutation-helpers/authorship-helpers'
import { logError, logInfo } from '@/infrastructure/logging/logger'
import { StorageServiceLive } from '@/infrastructure/storage/storage-service-live'
import { evictTransformCacheForKey } from '@/infrastructure/storage/transform-cache'
import { PURGED_AUTH_TABLES, PURGED_SYSTEM_TABLES } from './account-purge-coverage'
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
 * App tables are passed in by the caller as {@link PurgeTableAuthorship} — the
 * table name plus its authorship columns RESOLVED FROM THE DECLARED FIELD TYPES,
 * not assumed to be the literal `created_by`. Names are sanitized again here as
 * a defence-in-depth measure before interpolation into raw SQL.
 *
 * Which SYSTEM and AUTH tables the sweep covers is no longer hand-written here:
 * it comes from the census in `account-purge-coverage.ts`, which this module
 * consumes and which `account-purge-coverage.test.ts` checks against the live
 * Drizzle schema. The enumeration below was previously the only record of what
 * erasure deletes, and it was silently incomplete — see that module's header.
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
 * nothing cascades and nothing names them but the shed candidates.
 *
 * These are the LITERAL spellings only. A `updated-by` / `deleted-by` field can
 * be declared under any name, so {@link resolvePurgeTableAuthorship} unions this
 * list with the names resolved from the table's field TYPES. The literals are
 * kept rather than replaced because engine-generated tables (`auth.scopeTables`)
 * carry a literal `updated_by` with no declared field to resolve from.
 */
const SHED_AUTHORSHIP_FIELDS = [AUTHORSHIP_FIELDS.UPDATED_BY, AUTHORSHIP_FIELDS.DELETED_BY] as const

/**
 * One app table's authorship columns, RESOLVED FROM THE CONFIG rather than
 * assumed from the literal column names.
 *
 * The literal names are not a contract. `CreatedByFieldSchema` puts no
 * constraint on `name`, so `{ name: 'author', type: 'created-by' }` is a valid
 * table field and generates a column called `author`; nothing auto-creates a
 * `created_by` alongside it. Erasure matched `created_by` by literal name, so a
 * config that never uses that spelling — `templates/api-only` and
 * `templates/mcp-server` are exactly this shape — had ZERO app-table rows
 * deleted, silently, behind an HTTP 200 and a truthful-looking `purgedCount: 1`.
 *
 * Resolution is by FIELD TYPE, via the same `@/domain/services/authorship-fields`
 * helpers the WRITE path already uses (GAP-16/GAP-21). That the write path was
 * type-driven while the erasure path stayed name-driven is what made the gap
 * invisible: records were stamped into `author` correctly and then never swept.
 *
 * The literal names stay in the candidate set alongside the resolved ones —
 * `auth.scopeTables` and other engine-generated tables carry a literal
 * `created_by` with no declared field to resolve from, so dropping the literals
 * would trade one blind spot for another. Every candidate is introspected
 * before use, so extra ones cost nothing but a wider `IN (...)` list.
 */
export interface PurgeTableAuthorship {
  /** The table name. */
  readonly name: string
  /** Columns whose match means "the user AUTHORED this row" — the row is deleted. */
  readonly createdByColumns: readonly string[]
  /** Columns whose match means "the user ACTED ON this row" — the stamp is shed. */
  readonly shedColumns: readonly string[]
}

/** {@link PurgeTableAuthorship} narrowed to the columns that actually exist. */
interface ProbedAuthorship {
  readonly createdBy: readonly string[]
  readonly shed: readonly string[]
}

/**
 * Resolve one app table's authorship columns from its declared field types.
 *
 * Exported so the presentation-layer purge trigger builds the same shape the
 * sweep consumes, instead of passing bare table names and letting the
 * infrastructure guess at the column spelling.
 */
export const resolvePurgeTableAuthorship = (
  tables: Parameters<typeof createdByFieldNames>[0],
  tableName: string
): PurgeTableAuthorship => ({
  name: tableName,
  createdByColumns: [
    ...new Set([AUTHORSHIP_FIELDS.CREATED_BY, ...createdByFieldNames(tables, tableName)]),
  ],
  shedColumns: [
    ...new Set([
      ...SHED_AUTHORSHIP_FIELDS,
      ...updatedByFieldNames(tables, tableName),
      ...deletedByFieldNames(tables, tableName),
    ]),
  ],
})

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
  appTables: readonly PurgeTableAuthorship[]
): Promise<ReadonlyMap<string, ProbedAuthorship>> {
  if (appTables.length === 0) return new Map()

  const sanitized = appTables
    .map((table) => ({ ...table, name: sanitizeTableName(table.name) }))
    .filter((table) => table.name.length > 0)
  if (sanitized.length === 0) return new Map()

  // The transaction handle drives `getExistingColumnNames` as a `RawSqlRunner`
  // — it carries `execute()` (Postgres) or `all()` (SQLite); the helper picks
  // whichever the active dialect needs.
  const runner = tx as unknown as RawSqlRunner
  const probed = await Promise.all(
    sanitized.map(async (table) => {
      const candidates = [...new Set([...table.createdByColumns, ...table.shedColumns])]
      const existing = await getExistingColumnNames(runner, table.name, candidates)
      return [
        table.name,
        {
          createdBy: table.createdByColumns.filter((column) => existing.has(column)),
          shed: table.shedColumns.filter((column) => existing.has(column)),
        },
      ] as const
    })
  )
  return new Map(
    probed.filter(([, columns]) => columns.createdBy.length > 0 || columns.shed.length > 0)
  )
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
 * Delete the erased user's rows from every table the census marks `delete`.
 *
 * The manifest (`account-purge-coverage.ts`) is the SINGLE source for this list,
 * so what an operator reads and what the engine runs cannot drift — the
 * hand-written duplication this replaces is precisely how
 * `system.form_submissions`, `system.activity_logs`,
 * `auth.oauth_access_token`, `system.file_storage_metadata` and
 * `system.ai_tool_calls` each came to be erased by nobody. A table added to the
 * manifest is swept from the next run; a user-referencing table added to the
 * SCHEMA and not to the manifest fails `account-purge-coverage.test.ts`.
 *
 * Every predicate is the same shape — `WHERE <column> = <userId>` — so the two
 * namespaces differ only in how the table name resolves. Compound-predicate
 * cases (`ai_activity_logs`, `ai_tool_calls`) keep their own statements.
 *
 * NOT probed for existence, deliberately, and unlike
 * {@link USER_OWNED_GATED_SYSTEM_TABLES}. Every table here is created by the
 * migration baseline on BOTH dialects, so the rule this file already follows
 * applies: probe what is config-GATED (`comment_read_state`, `user_access`),
 * delete unconditionally what the baseline guarantees — exactly as the
 * `form_submissions`, `record_comments` and `_admin_search_index` statements
 * below already do. Probing all eighteen would add eighteen catalog round trips
 * per erasure to answer a question the migration already settled.
 *
 * @param tx - the open erasure transaction.
 * @param userId - the user being erased.
 */
async function deleteCensusRows(tx: Readonly<DrizzleTransaction>, userId: string): Promise<void> {
  // eslint-disable-next-line functional/no-loop-statements -- sequential DELETEs inside one transaction
  for (const entry of PURGED_SYSTEM_TABLES) {
    // eslint-disable-next-line functional/no-expression-statements -- DB side effect
    await executeRaw(
      tx,
      sql`DELETE FROM ${systemTableRef(entry.table)} WHERE ${sql.identifier(entry.column)} = ${userId}`
    )
  }

  // eslint-disable-next-line functional/no-loop-statements -- sequential DELETEs inside one transaction
  for (const entry of PURGED_AUTH_TABLES) {
    // eslint-disable-next-line functional/no-expression-statements -- DB side effect
    await executeRaw(
      tx,
      sql`DELETE FROM ${authTableRef(entry.table)} WHERE ${sql.identifier(entry.column)} = ${userId}`
    )
  }
}

/**
 * Delete the erased user's AI tool-call transcripts.
 *
 * Kept out of {@link deleteCensusRows} because the predicate is COMPOUND.
 * `system.ai_tool_calls` has no foreign key: `caller_id` is a bare `TEXT`
 * column holding the raw user id when `caller_type = 'user'` and an API-token
 * tag otherwise. Matching on `caller_id` alone would sweep a token whose tag
 * happened to equal a user id — deleting another principal's audit trail in the
 * name of this user's privacy — so the type is part of the predicate.
 *
 * DELETED rather than shed: `caller_id` is `NOT NULL`, and `input`/`output` hold
 * the prompt and the record payloads the tool read or wrote, so orphaning the
 * row would leave the content and remove only the attribution.
 *
 * @param tx - the open erasure transaction.
 * @param userId - the user being erased.
 */
async function deleteAiToolCallRows(
  tx: Readonly<DrizzleTransaction>,
  userId: string
): Promise<void> {
  // eslint-disable-next-line functional/no-expression-statements -- DB side effect
  await executeRaw(
    tx,
    sql`DELETE FROM ${systemTableRef('ai_tool_calls')}
        WHERE caller_type = 'user' AND caller_id = ${userId}`
  )
}

/**
 * Shed the erased user's identifier from the short links they published.
 *
 * `system.links.created_by` is a bare `TEXT` column with no foreign key, so
 * nothing cascaded and nothing named it: the erased id simply stayed.
 *
 * SHED, not deleted, for the {@link shedGrantIssuerIdentifier} reason. A link is
 * a live URL that third parties click and that other systems link to; deleting
 * it because its author closed their account breaks somebody else's traffic —
 * over-deletion in the name of erasure. The identifier goes, the redirect
 * stands.
 *
 * @param tx - the open erasure transaction.
 * @param userId - the user being erased.
 */
async function shedLinkAuthorIdentifier(
  tx: Readonly<DrizzleTransaction>,
  userId: string
): Promise<void> {
  // eslint-disable-next-line functional/no-expression-statements -- DB side effect
  await executeRaw(
    tx,
    sql`UPDATE ${systemTableRef('links')} SET created_by = NULL WHERE created_by = ${userId}`
  )
}

/**
 * Shed the minter's identifier from design-system share links, keeping the
 * links alive.
 *
 * The `system.links` shape exactly. A share token is an unlisted URL somebody
 * OUTSIDE the organisation is holding — a designer, an agency, a client — and
 * deleting the row because the admin who minted it closed their account revokes
 * a third party's live access in the name of erasure. Nothing personal is left
 * behind by shedding instead: the document the token serves projects
 * `design.*` and `theme.*` only, never session-derived content ([internal ref] A3), so
 * the minter's id is the sole trace of the person and it is what goes. The row
 * survives, which is also what keeps the organisation able to revoke the link.
 *
 * @param tx - the open erasure transaction.
 * @param userId - the user being erased.
 */
async function shedDesignSystemShareMinterIdentifier(
  tx: Readonly<DrizzleTransaction>,
  userId: string
): Promise<void> {
  // eslint-disable-next-line functional/no-expression-statements -- DB side effect
  await executeRaw(
    tx,
    sql`UPDATE ${systemTableRef('design_system_shares')} SET created_by = NULL WHERE created_by = ${userId}`
  )
}

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
  appTables: readonly PurgeTableAuthorship[]
): Promise<void> {
  const authorshipTables = await authorshipColumnsByTable(tx, appTables)

  // eslint-disable-next-line functional/no-loop-statements -- sequential writes inside one transaction
  for (const [tableName, columns] of authorshipTables) {
    // eslint-disable-next-line functional/no-loop-statements -- sequential DELETEs inside one transaction
    for (const column of columns.createdBy) {
      // eslint-disable-next-line functional/no-expression-statements -- DB side effect
      await executeRaw(
        tx,
        sql`DELETE FROM ${sql.identifier(tableName)} WHERE ${sql.identifier(column)} = ${userId}`
      )
    }

    // eslint-disable-next-line functional/no-loop-statements -- sequential UPDATEs inside one transaction
    for (const column of columns.shed) {
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
 * @param appTables - App tables with their CONFIG-RESOLVED authorship columns
 *   (see {@link PurgeTableAuthorship}); build them with
 *   {@link resolvePurgeTableAuthorship}.
 */
/**
 * The user's stored `auth.user.image`, read BEFORE the erasure transaction runs.
 *
 * The purge deletes the row, so this value is unrecoverable afterwards — and it
 * is the only reachable handle on the user's avatar object. Attribution cannot
 * substitute for it: `file_storage_metadata.uploaded_by_id` is written by
 * NOTHING (it appears only in schema and manifest files), so a purge predicate
 * on that column matches zero rows for every user. The column the avatar route
 * itself wrote is what names the object.
 */
async function readStoredAvatarImage(userId: string): Promise<string | null> {
  const rows = (await executeRaw(
    db,
    sql`SELECT image FROM ${authTableRef('user')} WHERE id = ${userId}`
  )) as unknown as readonly { image: string | null }[]
  // eslint-disable-next-line unicorn/no-null -- `null` is the column's own "no avatar" value
  return rows[0]?.image ?? null
}

/**
 * Delete the erased user's avatar object from the blob store.
 *
 * Runs AFTER the transaction commits, deliberately. Storage is not
 * transactional, so a delete issued inside the transaction would be permanent
 * even if the transaction then rolled back — erasing the file of an account
 * that still exists. Committing first means the worst case is the opposite and
 * far safer one: a row that is gone and an object that is not, which the log
 * line below makes findable.
 *
 * The transform-cache eviction is not housekeeping either. `serveFileDownload`
 * answers from a process-local LRU before it ever reaches storage, so any avatar
 * that has been fetched once would keep being served over HTTP after erasure —
 * retained personal data (Art. 17) that no amount of SQL would remove.
 *
 * A value the instance did not issue (a legacy external URL) names no local
 * object and is skipped.
 */
async function removeErasedAvatarObject(userId: string, image: string | null): Promise<void> {
  const key = avatarStorageKeyFromUrl(image)
  if (key === undefined) return

  const program = Effect.gen(function* () {
    const storage = yield* StorageService
    // Bracket notation dodges a `drizzle/enforce-delete-with-where` false
    // positive on the storage port's `delete` — same workaround as `buckets.ts`.
    yield* storage['delete'](key, AVATAR_BUCKET_NAME)
  }).pipe(Effect.provide(StorageServiceLive), Effect.result)

  const result = await Effect.runPromise(program)
  if (result._tag === 'Failure') {
    logError(`[account-purge] avatar object ${key} survived erasure of ${userId}`, result.failure)
  }
  evictTransformCacheForKey(key)
}

export async function purgeAccount(
  userId: string,
  appTables: readonly PurgeTableAuthorship[]
): Promise<void> {
  // Read the avatar BEFORE the row is deleted — see {@link readStoredAvatarImage}.
  const storedAvatarImage = await readStoredAvatarImage(userId)

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
    await sweepAppTableAuthorship(tx, userId, appTables)

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
    await deleteUserOwnedGatedSystemRows(tx, userId)

    // 4b. The grants the user ISSUED to other people. Those rows are somebody
    //     else's live authorization, so only the issuer identifier goes.
    await shedGrantIssuerIdentifier(tx, userId)

    // 4c. The AI-interaction activity feed, which names the user by id AND by
    //     address across two bare columns. Hard DELETE — nothing survives the
    //     removal of the actor there.
    await deleteAiActivityRows(tx, userId, erasedEmail)

    // 4d. Every table the erasure census marks `delete` — the 2026-08-26
    //     coverage audit's eighteen, driven straight off the manifest so the
    //     list an operator reads is the list the engine runs.
    await deleteCensusRows(tx, userId)

    // 4e. AI tool-call transcripts, whose predicate is compound (`caller_type`
    //     scopes the bare `caller_id`).
    await deleteAiToolCallRows(tx, userId)

    // 4f. Short links the user published. SHED, not deleted — the URL is live
    //     third-party traffic; only the author's identifier goes.
    await shedLinkAuthorIdentifier(tx, userId)

    // 4g. Design-system share links the user minted. SHED for the same reason:
    //     somebody outside the organisation is holding the URL, and the
    //     document it serves carries no personal data to begin with.
    await shedDesignSystemShareMinterIdentifier(tx, userId)

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

    // 6b. Shed this user's identifier from OTHER people's sessions.
    //     `auth.session.impersonated_by` records an ADMIN who impersonated the
    //     session's owner, so the row belongs to the impersonated party and must
    //     survive — only the erased admin's raw id goes. The column is a bare
    //     TEXT with no FK on either dialect, so nothing sheds it on commit.
    //
    //     The census in `account-purge-coverage.ts` has asserted verdict `shed`
    //     for this column all along, with a written reason, and no statement
    //     performed it. The coverage drift test proves reachability only for
    //     `delete` verdicts, so a `shed` claim was documentation rather than
    //     behaviour — and an erased admin's user id survived in every session row
    //     of everyone they had ever impersonated.
    // eslint-disable-next-line functional/no-expression-statements -- DB side effect
    await executeRaw(
      tx,
      sql`UPDATE ${authTableRef('session')} SET impersonated_by = NULL WHERE impersonated_by = ${userId}`
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
    await appendAuditEntryToDbTx(tx, buildPurgeAuditEntry(userId, erasedEmail))

    // 11. The parent auth.user row — FK fires on commit, null-ifying actor_id
    //    and shedding every `type: 'user'` assignment on records this user did
    //    not author.
    // eslint-disable-next-line functional/no-expression-statements -- DB side effect
    await executeRaw(tx, sql`DELETE FROM ${authTableRef('user')} WHERE id = ${userId}`)
  })

  // The row is gone; now shed the personal-data OBJECT it pointed at. Post-commit
  // for the reason given on {@link removeErasedAvatarObject}.
  await removeErasedAvatarObject(userId, storedAvatarImage)

  logInfo(`[account-purge] Hard-deleted account ${userId}`)
}

/**
 * Run the erasure scheduler: hard-delete every account whose
 * `scheduledErasureAt` is in the past.
 *
 * @param appTables - App tables with their CONFIG-RESOLVED authorship columns.
 * @returns The number of accounts purged.
 */
export async function purgeDueAccounts(
  appTables: readonly PurgeTableAuthorship[]
): Promise<number> {
  const dueRows = (await executeRaw(
    db,
    sql`SELECT id FROM ${authTableRef('user')}
        WHERE "scheduledErasureAt" IS NOT NULL AND "scheduledErasureAt" <= ${sql.raw(nowEpochMsSqlLiteral())}`
  )) as unknown as readonly { id: string }[]

  // eslint-disable-next-line functional/no-loop-statements -- sequential per-account purge
  for (const row of dueRows) {
    await purgeAccount(row.id, appTables)
  }

  return dueRows.length
}
