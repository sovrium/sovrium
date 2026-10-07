/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { deleteOutstandingAccountDeletionTokens } from './account-deletion-tokens'
import { PURGED_AUTH_TABLES, PURGED_SYSTEM_TABLES } from './account-purge-coverage'
import { deleteCatalogRows } from './account-purge-objects'
import { executeRaw, type RawSqlRunner } from './sql/dialect-execute'
import { systemTableExists } from './sql/dialect-introspection'
import { authTableRef, systemTableRef } from './sql/dialect-sql'
import type { DrizzleTransaction } from '@/infrastructure/database'

/**
 * The individual statements of the erasure that each need their own predicate
 * or their own verdict. `eraseAccountRows` in `account-purge.ts` runs them in
 * order; each one's comment is the reason it deletes or sheds what it does.
 */

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
 * rows while being INVISIBLE to the enumeration in `eraseAccountRows` — the
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
 * so what an operator reads and what the engine runs cannot drift — a
 * hand-written duplicate is precisely how `system.form_submissions`,
 * `system.activity_logs`, `auth.oauth_access_token`,
 * `system.file_storage_metadata` and `system.ai_tool_calls` each came to be
 * erased by nobody. A table added to the manifest is swept from the next run; a
 * user-referencing table added to the SCHEMA and not to the manifest fails
 * `account-purge-coverage.test.ts`.
 *
 * Every predicate is the same shape — `WHERE <column> = <userId>` — so the two
 * namespaces differ only in how the table name resolves. Compound-predicate
 * cases (`ai_activity_logs`, `ai_tool_calls`) keep their own statements.
 *
 * NOT probed for existence, deliberately, and unlike
 * {@link USER_OWNED_GATED_SYSTEM_TABLES}. Every table here is created by the
 * migration baseline on BOTH dialects, so the rule this module follows
 * applies: probe what is config-GATED (`comment_read_state`, `user_access`),
 * delete unconditionally what the baseline guarantees — exactly as the
 * `form_submissions`, `record_comments` and `_admin_search_index` statements
 * already do. Probing all eighteen would add eighteen catalog round trips per
 * erasure to answer a question the migration already settled.
 *
 * @param tx - the open erasure transaction.
 * @param userId - the user being erased.
 */
export async function deleteCensusRows(
  tx: Readonly<DrizzleTransaction>,
  userId: string
): Promise<readonly string[]> {
  for (const entry of PURGED_SYSTEM_TABLES) {
    if (entry.table === 'file_storage_metadata') continue
    await executeRaw(
      tx,
      sql`DELETE FROM ${systemTableRef(entry.table)} WHERE ${sql.identifier(entry.column)} = ${userId}`
    )
  }

  for (const entry of PURGED_AUTH_TABLES) {
    await executeRaw(
      tx,
      sql`DELETE FROM ${authTableRef(entry.table)} WHERE ${sql.identifier(entry.column)} = ${userId}`
    )
  }
  // The object catalog, whose deleted keys the bytes are removed by after the commit.
  return deleteCatalogRows(tx, userId)
}

/**
 * Delete the erased user's AI tool-call transcripts.
 *
 * Kept out of {@link deleteCensusRows} because the predicate is COMPOUND.
 * `system.ai_tool_calls` has no foreign key: `caller_id` is a bare `TEXT`
 * column holding the user id under `caller_type` 'oauth' (or the older 'user')
 * and a `'token'` tag otherwise. Matching `caller_id` alone would sweep a token
 * row whose tag equals a user id — another principal's trail — so the type is
 * part of the predicate, and `'token'` is never swept.
 *
 * DELETED rather than shed: `caller_id` is `NOT NULL`, and `input`/`output` hold
 * the prompt and the record payloads the tool read or wrote, so orphaning the
 * row would leave the content and remove only the attribution.
 *
 * @param tx - the open erasure transaction.
 * @param userId - the user being erased.
 */
export async function deleteAiToolCallRows(
  tx: Readonly<DrizzleTransaction>,
  userId: string
): Promise<void> {
  await executeRaw(
    tx,
    sql`DELETE FROM ${systemTableRef('ai_tool_calls')}
        WHERE caller_type IN ('oauth', 'user') AND caller_id = ${userId}`
  )
}

/**
 * Shed the erased user's identifier from the short links they published.
 *
 * `system.links.created_by` is a bare `TEXT` column with no foreign key, so
 * nothing cascades and nothing names it: without this statement the erased id
 * would simply stay.
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
export async function shedLinkAuthorIdentifier(
  tx: Readonly<DrizzleTransaction>,
  userId: string
): Promise<void> {
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
 * `design.*` and `theme.*` only, never session-derived content, so the minter's
 * id is the sole trace of the person and it is what goes. The row survives,
 * which is also what keeps the organisation able to revoke the link.
 *
 * @param tx - the open erasure transaction.
 * @param userId - the user being erased.
 */
export async function shedDesignSystemShareMinterIdentifier(
  tx: Readonly<DrizzleTransaction>,
  userId: string
): Promise<void> {
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
export async function deleteUserOwnedGatedSystemRows(
  tx: Readonly<DrizzleTransaction>,
  userId: string
): Promise<void> {
  const runner = tx as RawSqlRunner

  for (const tableName of USER_OWNED_GATED_SYSTEM_TABLES) {
    if (await systemTableExists(runner, tableName)) {
      await executeRaw(tx, sql`DELETE FROM ${systemTableRef(tableName)} WHERE user_id = ${userId}`)
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
export async function shedGrantIssuerIdentifier(
  tx: Readonly<DrizzleTransaction>,
  userId: string
): Promise<void> {
  const runner = tx as RawSqlRunner
  if (!(await systemTableExists(runner, 'user_access'))) return

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
 * These rows are DELETED rather than shed, unlike the authorship stamps, for two
 * reasons. `actor_name` is `NOT NULL`, so there is nothing to shed it to short of
 * overwriting it with an invented placeholder — fabricating attribution rather
 * than removing it. And what survives the removal is
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
export async function deleteAiActivityRows(
  tx: Readonly<DrizzleTransaction>,
  userId: string,
  erasedEmail: string | undefined
): Promise<void> {
  await executeRaw(
    tx,
    sql`DELETE FROM ${systemTableRef('ai_activity_logs')}
        WHERE actor_type = 'user' AND actor_name = ${userId}`
  )

  // Matched as a separate statement rather than one `OR`-ed predicate so a user
  // whose email could not be read is never turned into an empty-string match.
  if (erasedEmail === undefined) return
  await executeRaw(
    tx,
    sql`DELETE FROM ${systemTableRef('ai_activity_logs')}
        WHERE actor_type = 'user' AND (actor_name = ${erasedEmail} OR user_email = ${erasedEmail})`
  )
}

/**
 * The erased user's `auth.verification` rows. Most are keyed by the user's
 * email identifier; an account-deletion link is keyed by a random identifier
 * and holds the user's ID as its value, so it is swept separately — without
 * that a second, unused link would outlive the account it names.
 */
export async function deleteVerificationRows(
  tx: Readonly<DrizzleTransaction>,
  userId: string
): Promise<void> {
  await executeRaw(
    tx,
    sql`DELETE FROM ${authTableRef('verification')}
        WHERE identifier IN (SELECT email FROM ${authTableRef('user')} WHERE id = ${userId})`
  )
  await executeRaw(tx, deleteOutstandingAccountDeletionTokens(userId))
}
