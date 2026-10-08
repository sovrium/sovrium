/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { adminRoleNamesFor } from '@/domain/models/app/auth/roles/role-write-validation'
import { db } from '@/infrastructure/database'
import { logInfo } from '@/infrastructure/logging/logger'
import { settleAuditTrail } from './account-purge-audit'
import { erasureReach, sweepAppTableAuthorship } from './account-purge-authorship'
import { deleteFormSubmissionsOf } from './account-purge-form-submissions'
import {
  LIVE_ERASURE_SEAMS,
  settleCommittedErasure,
  type ErasureSeams,
} from './account-purge-objects'
import {
  eraseUnderLastAdminRail,
  lockAdminCandidates,
  readErasureSubject,
  type PurgeOutcome,
} from './account-purge-rail'
import { collectErasedRecords } from './account-purge-runs'
import { redactErasedSignatures } from './account-purge-signatures'
import {
  deleteAiActivityRows,
  deleteAiToolCallRows,
  deleteCensusRows,
  deleteUserOwnedGatedSystemRows,
  deleteVerificationRows,
  shedDesignSystemShareMinterIdentifier,
  shedGrantIssuerIdentifier,
  shedLinkAuthorIdentifier,
} from './account-purge-steps'
import { scrubWhatErasureReaches } from './account-purge-webhooks'
import { executeRaw } from './sql/dialect-execute'
import { authTableRef, systemTableRef } from './sql/dialect-sql'
import type { PurgeTableAuthorship } from './account-purge-authorship'
import type { AdminRoleResolvable } from '@/domain/models/app/auth/roles'
import type { DrizzleTransaction } from '@/infrastructure/database'

/**
 * GDPR Art. 17 hard-delete purge path.
 *
 * `purgeAccount` PHYSICALLY removes (`DELETE FROM`, never a `deleted_at`
 * tombstone) every personal-data row belonging to a user, in one
 * transaction, in FK-safe order (children before parent). The purge
 * scheduler (`purgeDueAccounts`, `account-purge-sweep.ts`) finds users whose
 * erasure grace window has elapsed and purges each of them.
 *
 * This file holds the ORDER of the erasure — {@link eraseAccountRows} — and the
 * transaction around it. The statements it runs live beside it: the app-table
 * authorship sweep in `account-purge-authorship.ts`, the system and auth
 * statements in `account-purge-steps.ts`, the audit-trail writes in
 * `account-purge-audit.ts`.
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
 * The user's stored `auth.user.image`, read BEFORE the erasure transaction runs.
 *
 * The purge deletes the row, so this value is unrecoverable afterwards. Since
 * every upload road records its uploader, the catalog names a NEW avatar as
 * hers like any other file (its key comes back from the census sweep); this
 * column remains the only handle on an avatar uploaded before it did, whose
 * catalog row carries no uploader.
 */
async function readStoredAvatarImage(userId: string): Promise<string | null> {
  const rows = (await executeRaw(
    db,
    sql`SELECT image FROM ${authTableRef('user')} WHERE id = ${userId}`
  )) as readonly { image: string | null }[]
  return rows[0]?.image ?? null
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
 *      see `SHED_AUTHORSHIP_FIELDS` in `account-purge-authorship.ts`)
 *   2. `system.form_submissions` rows where `submitter_user_id = userId`, and
 *      the `draft` rows saved under their address
 *   3. `system.record_comments` rows where `user_id = userId`
 *   4. `system.comment_read_state` + `system.user_access` rows where
 *      `user_id = userId` (both config-gated — see
 *      `USER_OWNED_GATED_SYSTEM_TABLES` in `account-purge-steps.ts`); then `user_access.created_by`
 *      NULL-ified on the grants the user ISSUED to other people
 *      ({@link shedGrantIssuerIdentifier}); then the `system.ai_activity_logs`
 *      rows naming the user by id or address ({@link deleteAiActivityRows})
 *   5. `system._admin_search_index` — the operator-search projection of the user
 *   6. `auth.verification` rows (matched by the user's email identifier, and
 *      every outstanding account-deletion token holding the user's id)
 *   7. `auth.two_factor` and `auth.passkey` rows (second-factor and passkey keys)
 *   8. `auth.session` rows
 *   9. `auth.account` rows, then `audit_log.actor_email` cleared on every
 *      entry the user made (the entries stay; the address goes)
 *  10. INSERT the `account.deletion.purged` audit entry. Its actor is the
 *      non-human sweep, so `actor_id` is NULL from the start; the metadata
 *      captures `erasedUserId` + `erasedEmail` so the audit trail can still
 *      answer "who was erased?".
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
async function eraseAccountRows(
  tx: Readonly<DrizzleTransaction>,
  userId: string,
  erasedEmail: string | undefined,
  appTables: readonly PurgeTableAuthorship[]
): Promise<readonly string[]> {
  // 0. The automation runs that read her records, a record naming her, or a
  //    record removed with hers — collected BEFORE anything below deletes or
  //    empties them — keep their steps and lose every value (`account-purge-runs.ts`).
  //    The table-webhook deliveries about her (`webhook_outbox`, found by
  //    `webhook_outbox_subjects.user_id` or by such a record) and their
  //    delivery-log rows are hard-deleted, so a pending one is never sent.
  await scrubWhatErasureReaches(
    tx,
    userId,
    await collectErasedRecords(tx, userId, erasureReach(appTables))
  )

  // 1. App-table records authored by the user, then the authorship stamps left
  //    on records authored by SOMEBODY ELSE — two deliberately different
  //    verdicts, see {@link sweepAppTableAuthorship}.
  await sweepAppTableAuthorship(tx, userId, appTables)

  // 2. Form-submission ledger rows the user submitted, and the drafts saved
  //    under their address — see `deleteFormSubmissionsOf`.
  await deleteFormSubmissionsOf(tx, userId, erasedEmail)

  // 3. Comments the user authored. BEHAVIOUR-NEUTRAL: `record_comments.user_id`
  //    carries `ON DELETE CASCADE` on both dialects, so step 9 already removes
  //    exactly these rows. Naming the table here is a readability contract, not
  //    a behaviour change — the enumeration in this function is what an operator
  //    reads to answer "what does erasure delete?", and a cascade is invisible
  //    to that reading. `moderated_by` is deliberately NOT matched: moderating
  //    someone else's comment is an act ON another user's content, and its FK
  //    is `ON DELETE SET NULL` (identifier shed, comment retained).
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

  // 4d. Every table the erasure census marks `delete` — the eighteen a
  //     coverage audit found, driven straight off the manifest so the
  //     list an operator reads is the list the engine runs. The keys of the
  //     catalog rows it deleted are what the bytes are removed by afterwards.
  const erasedObjectKeys = await deleteCensusRows(tx, userId)

  // 4d'. The signatures she gave on records that STAY lose her name and image
  //      and keep the statement she agreed to (`account-purge-signatures.ts`).
  //      A signature is hers when its image is one of the objects the catalog
  //      delete just returned, so this runs after 4d and in the same transaction.
  await redactErasedSignatures(tx, appTables, erasedObjectKeys)

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
  await executeRaw(
    tx,
    sql`DELETE FROM ${systemTableRef('_admin_search_index')}
          WHERE type = 'user' AND entity_id = ${userId}`
  )

  // 6. Verification rows: by the user's email identifier, and every
  //    outstanding account-deletion link — see {@link deleteVerificationRows}.
  await deleteVerificationRows(tx, userId)

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
  await executeRaw(
    tx,
    sql`UPDATE ${authTableRef('session')} SET impersonated_by = NULL WHERE impersonated_by = ${userId}`
  )
  // 7-9. Direct child rows of auth.user.
  for (const table of ['two_factor', 'passkey', 'session', 'account'] as const) {
    await executeRaw(tx, sql`DELETE FROM ${authTableRef(table)} WHERE user_id = ${userId}`)
  }

  // 9b-10. The audit trail: the user's address leaves the entries they made,
  //    and the `account.deletion.purged` entry is written — both while the
  //    user row still exists. See {@link settleAuditTrail}.
  await settleAuditTrail(tx, userId, erasedEmail)

  // 11. The parent auth.user row — FK fires on commit, null-ifying actor_id
  //    and shedding every `type: 'user'` assignment on records this user did
  //    not author.
  await executeRaw(tx, sql`DELETE FROM ${authTableRef('user')} WHERE id = ${userId}`)
  return erasedObjectKeys
}

/**
 * Physically delete every personal-data row owned by `userId`, unless it is the
 * last account that can administer the app — see {@link eraseUnderLastAdminRail}.
 *
 * The one erasure behind both deletion doors: the scheduled sweep and the link
 * `/delete-user` mails. What it deletes, and in which order, is set out on
 * {@link eraseAccountRows}'s steps above.
 *
 * @param userId - The user whose account is being erased.
 * @param appTables - App tables with their CONFIG-RESOLVED authorship columns
 *   (see {@link PurgeTableAuthorship}); build them with
 *   {@link resolvePurgeTableAuthorship}.
 * @param app - The app's roles, for who can administer it.
 * @returns `Erased`, or `Refused` with the rail's message when nothing was written.
 */
export async function purgeAccount(
  userId: string,
  appTables: readonly PurgeTableAuthorship[],
  app: AdminRoleResolvable,
  seams: ErasureSeams = LIVE_ERASURE_SEAMS
): Promise<PurgeOutcome> {
  // Read the avatar BEFORE the rows are deleted — see {@link readStoredAvatarImage}.
  // The keys of her objects are NOT read here: they come back from the rows the
  // transaction deletes, so a file stored in between is not left behind.
  const storedAvatarImage = await readStoredAvatarImage(userId)

  let objectKeys: readonly string[] = []
  const outcome = await seams.inTransaction(async (tx) =>
    eraseUnderLastAdminRail(userId, app, {
      readSubject: () => readErasureSubject(tx, userId),
      lockAdminCandidates: () => lockAdminCandidates(tx, adminRoleNamesFor(app)),
      // The email is captured BEFORE the user row goes: it lands in the
      // `account.deletion.purged` metadata so operators can answer "who was
      // erased?" once the row and the audit `actor_id`s are gone.
      erase: async (subject) => {
        objectKeys = await eraseAccountRows(tx, userId, subject?.email, appTables)
      },
    })
  )
  if (outcome._tag === 'Refused') return outcome

  // The rows are gone: close its live connections and shed its objects' bytes.
  await settleCommittedErasure(userId, { image: storedAvatarImage, objectKeys }, seams)

  logInfo(`[account-purge] Hard-deleted account ${userId}`)
  return outcome
}
