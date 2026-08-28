/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The declarative census of every table that references a user, and what GDPR
 * Art. 17 erasure does about it.
 *
 * ── Why this file exists ─────────────────────────────────────────────────────
 *
 * `purgeAccount` enumerates the tables it sweeps as a hand-written list of SQL
 * statements. Its own docstring warns that the enumeration is invisible to
 * inspection — a table added later, with or without a cascade, is erased by
 * nobody and nothing says so — and cites `system.form_submissions` as the case
 * that already escaped once. That warning was accurate and it did not help:
 * `system.activity_logs`, `auth.oauth_access_token`,
 * `system.file_storage_metadata`, `system.ai_tool_calls` and `system.links`
 * escaped the same way afterwards.
 *
 * A prose warning cannot catch the next one. This manifest can, because it is
 * checked MECHANICALLY against the live Drizzle schema by
 * `account-purge-coverage.test.ts`: any table carrying a foreign key to
 * `auth.user`, or a bare user-shaped column, must appear here with an explicit
 * verdict — including `exempt`, whose whole point is that a deliberate decision
 * not to purge is recorded rather than being indistinguishable from an
 * oversight. Adding a user-referencing table without classifying it fails
 * `bun run quality`.
 *
 * ── The four verdicts ────────────────────────────────────────────────────────
 *
 * `delete`  The rows are the erased user's own content and `purgeAccount`
 *           physically removes them (`DELETE FROM`, never a `deleted_at`
 *           tombstone). Named here even when a foreign key would already
 *           cascade, because a cascade is exactly what this manifest exists to
 *           make visible.
 *
 * `cascade` Removed by a foreign key's `ON DELETE CASCADE` when the parent
 *           `auth.user` row goes, and NOT separately named in the purge SQL.
 *           Distinguished from `delete` so a reader can see which rows depend
 *           on the database for their removal, and so flipping a cascade off
 *           shows up here as a lie rather than as silent retention.
 *
 * `shed`    The row belongs to somebody else, or is a live authorization a
 *           third party still depends on. The erased user's identifier is
 *           removed and the row stands. Over-deleting here would destroy
 *           another person's work in the name of the erased user's privacy.
 *
 * `exempt`  No linkage to purge, or a deliberate retention. Every entry states
 *           WHY, because an exemption without a reason is an omission with
 *           better spelling.
 */

/** What erasure does about one user-referencing table. */
export type ErasureVerdict = 'delete' | 'cascade' | 'shed' | 'exempt'

/** One classified table in the erasure census. */
export interface ErasureCoverageEntry {
  /** What erasure does. */
  readonly verdict: ErasureVerdict
  /** The user-referencing column(s) this verdict applies to. */
  readonly columns: readonly string[]
  /** Why — mandatory, and load-bearing for `shed` and `exempt`. */
  readonly reason: string
}

/**
 * Tables the purge DELETES from, keyed by their bare (namespace-less) name.
 *
 * Split out of {@link ERASURE_COVERAGE} because `purgeAccount` consumes it to
 * build the sweep, so the list an operator READS and the statements the engine
 * RUNS are the same array. The former hand-written duplication is what let the
 * enumeration and the behaviour drift apart in the first place.
 *
 * Each entry names the predicate column; the delete is always
 * `DELETE FROM <table> WHERE <column> = <userId>`. Tables needing a COMPOUND
 * predicate (`ai_activity_logs`, `ai_tool_calls`) cannot be expressed in that
 * shape, so they keep a bespoke statement in `account-purge.ts` and appear only
 * in {@link ERASURE_COVERAGE}. The drift check still reaches them: it takes
 * every `delete` verdict absent from this array and asserts the table is named
 * somewhere in the purge source.
 */
export const PURGED_SYSTEM_TABLES = [
  {
    table: 'ai_conversations',
    column: 'user_id',
    reason:
      'Chat transcripts. `user_id` cascades, so this DELETE is behaviour-neutral; ' +
      'it is named so the enumeration is the honest answer to "what does erasure delete?".',
  },
  {
    table: 'ai_facts',
    column: 'user_id',
    reason:
      'Derived long-term memory the agent inferred ABOUT the user — personal data ' +
      'by construction. Cascades; named for the same reason.',
  },
  {
    table: 'user_favorites',
    column: 'user_id',
    reason: 'Per-user bookmarks. Cascades; named.',
  },
  {
    table: 'user_recent_items',
    column: 'user_id',
    reason: 'Per-user browsing history — a behavioural trail. Cascades; named.',
  },
  {
    table: 'user_saved_views',
    column: 'user_id',
    reason: 'Per-user saved filters. Cascades; named.',
  },
  {
    table: 'user_table_preferences',
    column: 'user_id',
    reason: 'Per-user column layout. Cascades; named.',
  },
  {
    table: 'connection_tokens',
    column: 'user_id',
    reason:
      'Per-user third-party integration credentials. Cascades; named — a leaked ' +
      'credential is the one thing that must never depend on an invisible mechanism.',
  },
  {
    table: 'activity_logs',
    column: 'user_id',
    reason:
      'The per-record change feed. The FK is `ON DELETE SET NULL`, so erasure ' +
      'ORPHANED these rows rather than removing them — and what it orphaned is a ' +
      '`changes` JSONB holding before/after snapshots of the record fields. For a ' +
      'record the user authored, the record row itself is deleted by the ' +
      '`created_by` sweep, so the orphan was the full content of a deleted record, ' +
      'recoverable and attributable to nobody. DELETED rather than shed for the ' +
      '`ai_activity_logs` reason: `user_id` is not an attribute of an activity row, ' +
      'it is the subject of it — strip it and what remains is "somebody did ' +
      'something". The durable audit trail is `audit_log`, which is deliberately ' +
      'retained; this table is the change feed, not the audit of record.',
  },
  {
    table: 'file_storage_metadata',
    column: 'uploaded_by_id',
    reason:
      'Files the user uploaded. `uploaded_by_id` is `ON DELETE SET NULL`, so the ' +
      'metadata row (filename, mime type, storage path) survived erasure orphaned, ' +
      'and `file_storage_bytea.metadata_id` cascades off it — so the BYTES survived ' +
      'too whenever the DB-backed storage provider is in use. Deleting the metadata ' +
      'row now takes the bytea row with it. See the `file_storage_bytea` entry in ' +
      'ERASURE_COVERAGE for the external-object-store residual this does NOT reach.',
  },
] as const

/**
 * Auth-schema tables the purge DELETES from, keyed by their bare name.
 *
 * Separate from {@link PURGED_SYSTEM_TABLES} only because they resolve through
 * `authTableRef` (`auth.x` / `auth_x`) rather than `systemTableRef`.
 */
export const PURGED_AUTH_TABLES = [
  {
    table: 'oauth_access_token',
    column: 'user_id',
    reason:
      'A LIVE BEARER TOKEN. `user_id` is `ON DELETE SET NULL` while every sibling ' +
      '(`oauth_client`, `oauth_refresh_token`, `oauth_consent`) cascades — the one ' +
      'inconsistency in the OAuth family, and the most dangerous place to have it. ' +
      'A token whose `refresh_id` is set is taken out by the refresh row cascading, ' +
      'but a token issued WITHOUT a refresh token has a NULL `refresh_id` and ' +
      'nothing removes it: erasure left an ownerless credential that still ' +
      'authenticates. Deleted before the user row so the SET NULL never fires.',
  },
  {
    table: 'oauth_client',
    column: 'user_id',
    reason: 'OAuth clients the user registered. Cascades; named.',
  },
  {
    table: 'oauth_refresh_token',
    column: 'user_id',
    reason: 'Long-lived refresh credentials. Cascades; named.',
  },
  {
    table: 'oauth_consent',
    column: 'user_id',
    reason: 'Recorded grants of consent to third-party clients. Cascades; named.',
  },
  {
    table: 'api_key',
    column: 'reference_id',
    reason:
      'Personal API keys — credentials, keyed by `reference_id` rather than ' +
      '`user_id` (Better Auth naming). Cascades; named.',
  },
  {
    table: 'member',
    column: 'user_id',
    reason: 'Organization memberships. Cascades; named.',
  },
  {
    table: 'team_member',
    column: 'user_id',
    reason: 'Team memberships. Cascades; named.',
  },
  {
    table: 'invitation',
    column: 'inviter_id',
    reason:
      'Invitations the user SENT, which carry the invitee address alongside the ' +
      'erased inviter. Cascades; named.',
  },
] as const

/**
 * The complete census: every table the schema scan flags as user-referencing,
 * with its verdict. Checked against the live Drizzle schema by
 * `account-purge-coverage.test.ts`.
 *
 * Keys are `<namespace>.<table>` as the scan reports them.
 */
export const ERASURE_COVERAGE: Readonly<Record<string, ErasureCoverageEntry>> = {
  // ── Purged outright ────────────────────────────────────────────────────────
  ...Object.fromEntries(
    PURGED_SYSTEM_TABLES.map((entry) => [
      `system.${entry.table}`,
      { verdict: 'delete' as const, columns: [entry.column], reason: entry.reason },
    ])
  ),
  ...Object.fromEntries(
    PURGED_AUTH_TABLES.map((entry) => [
      `auth.${entry.table}`,
      { verdict: 'delete' as const, columns: [entry.column], reason: entry.reason },
    ])
  ),

  // ── Purged by a bespoke, compound predicate in `account-purge.ts` ──────────
  'system.form_submissions': {
    verdict: 'delete',
    columns: ['submitter_user_id'],
    reason:
      'The submitted BODY is itself personal data (people disclose addresses and ' +
      'phone numbers in free-text fields), so the row is removed rather than ' +
      'orphaned. No FK on either dialect. Anonymous submissions (NULL submitter) ' +
      'belong to nobody and are untouched.',
  },
  'system.record_comments': {
    verdict: 'delete',
    columns: ['user_id'],
    reason: 'Comments the user authored. Cascades; named.',
  },
  'system.comment_read_state': {
    verdict: 'delete',
    columns: ['user_id'],
    reason:
      'A per-user read watermark: strip the user and nothing meaningful is left. ' +
      'Config-gated, so probed for existence first.',
  },
  'system.ai_activity_logs': {
    verdict: 'delete',
    columns: ['actor_name', 'user_email'],
    reason:
      'Names the acting person twice, by raw user id AND by address, in two bare ' +
      "columns. Compound predicate scoped to `actor_type = 'user'` so agent rows " +
      'are never swept by a colliding name.',
  },
  'system.ai_tool_calls': {
    verdict: 'delete',
    columns: ['caller_id'],
    reason:
      'Every AI tool invocation, with `input`/`output` JSONB holding the prompt and ' +
      'the record payloads it read or wrote. No FK: `caller_id` is a bare column ' +
      "holding the user id under `caller_type = 'user'` and a token tag otherwise, " +
      'so nothing cascaded and nothing named it. Compound predicate, scoped to ' +
      "`caller_type = 'user'` so a token tag colliding with a user id is never swept.",
  },
  'auth.account': {
    verdict: 'delete',
    columns: ['user_id'],
    reason:
      'Linked identity providers, holding the password hash and OAuth secrets. ' +
      'Deleted explicitly by `purgeAccount` (step 9) before the user row.',
  },
  'auth.two_factor': {
    verdict: 'delete',
    columns: ['user_id'],
    reason:
      'TOTP secrets and backup codes. Deleted explicitly by `purgeAccount` ' +
      '(step 7) before the user row.',
  },
  'system._admin_search_index': {
    verdict: 'delete',
    columns: [],
    reason:
      'A DERIVED projection whose `title` holds the erased address, rebuilt by an ' +
      "upsert that never prunes. Matched on `type = 'user' AND entity_id`. Carries " +
      'no user-shaped column, so the schema scan does not flag it — listed anyway ' +
      'because the census is what an operator reads.',
  },

  // ── Identifier shed, row retained ─────────────────────────────────────────
  'system.user_access': {
    verdict: 'delete',
    columns: ['user_id'],
    reason:
      'Row-level access grants naming the user as GRANTEE. The row is wholly ' +
      'theirs — a grant to nobody is a dangling authorization, not a retained ' +
      'fact — and `user_id` is NOT NULL and part of the unique index the ' +
      'mark-read upsert conflicts on, so orphaning is not even available. ' +
      'Config-gated, so probed for existence first. The ISSUER column gets the ' +
      'opposite verdict; see the `system.user_access.created_by` entry.',
  },
  'system.user_access.created_by': {
    verdict: 'shed',
    columns: ['created_by'],
    reason:
      'The ISSUER of a grant handed to somebody ELSE. Deleting on this column ' +
      "would revoke a THIRD PARTY's live access because the issuer closed their " +
      'account — over-deletion in the name of erasure. The identifier goes and ' +
      'the authorization stands. Keyed separately because one table carries two ' +
      'columns with opposite verdicts, exactly like `record_comments`.',
  },
  'system.links': {
    verdict: 'shed',
    columns: ['created_by'],
    reason:
      'A published short URL that other people click and that other systems link ' +
      'to. Deleting it would break live third-party traffic because its author ' +
      'closed their account — over-deletion, the `user_access.created_by` shape ' +
      'exactly. Nothing touched this column before, so the erased id simply stayed; ' +
      'it is now NULL-ified and the redirect keeps working.',
  },
  'system.design_system_shares': {
    verdict: 'shed',
    columns: ['created_by'],
    reason:
      'An unlisted link handed to somebody OUTSIDE the organisation — a designer, ' +
      'an agency, a client stakeholder. Deleting the row would silently kill their ' +
      'access because the admin who minted it left, which is over-deletion in the ' +
      'name of erasure: the same shape as `system.links`, and the same answer. ' +
      'Nothing personal survives the shed either way — the document the token ' +
      'serves projects `design.*` and `theme.*` only, never session-derived ' +
      'content (ADR-022 A3), so the erased id is the only trace of the person and ' +
      'it is what goes. The row stays addressable, so the organisation keeps the ' +
      'one control that matters: it can still revoke the link.',
  },
  'system.connections': {
    verdict: 'shed',
    columns: ['created_by_id'],
    reason:
      'A shared integration the whole workspace uses. `ON DELETE SET NULL` already ' +
      'sheds the creator on commit and the connection keeps serving everybody else. ' +
      'The per-user credentials on `connection_tokens` are deleted separately.',
  },
  'system.automation_runs': {
    verdict: 'shed',
    columns: ['triggered_by_user_id'],
    reason:
      "An execution record of a workspace automation, not the user's content. " +
      "`ON DELETE SET NULL` is the schema's documented intent — NULL is the " +
      '"system-triggered" sentinel, so a shed run reads as system-triggered rather ' +
      'than as a dangling id.',
  },
  'system.automation_pauses': {
    verdict: 'shed',
    columns: ['paused_by_user_id'],
    reason:
      'A pause acts ON a workspace automation. Deleting the pause because its author ' +
      'left would silently RESUME an automation somebody deliberately stopped.',
  },
  'system.automation_approval_requests': {
    verdict: 'shed',
    columns: ['requested_by_id', 'approved_by_id'],
    reason:
      'An approval decision on a workspace automation run. `ON DELETE SET NULL` ' +
      "sheds both stamps; deleting the request would erase another approver's " +
      'decision and unblock a run nobody re-approved.',
  },
  'auth.session': {
    verdict: 'shed',
    columns: ['impersonated_by'],
    reason:
      "The erased user's OWN sessions are deleted by the purge. `impersonated_by` " +
      'is the opposite direction — an ADMIN who impersonated somebody — and the ' +
      'session belongs to the impersonated party, so it is shed, not deleted. Bare ' +
      'column, no FK.',
  },
  'system.audit_log': {
    verdict: 'shed',
    columns: ['actor_id'],
    reason:
      'The canonical, deliberately-retained event store. `ON DELETE SET NULL` sheds ' +
      'the actor on commit while the trail survives — including the ' +
      '`account.deletion.purged` entry that proves the erasure happened. Destroying ' +
      'the audit trail to satisfy erasure would remove the evidence of erasure.',
  },

  // ── Deliberately not purged ───────────────────────────────────────────────
  'auth.oauth_client_resource': {
    verdict: 'cascade',
    columns: [],
    reason:
      'RFC 8707 resource links. NO user column and no foreign key to `auth.user`, ' +
      'so the schema scan does not flag it — listed anyway because its removal ' +
      'depends on a chain worth stating. `client_id` references ' +
      '`oauth_client.client_id` (the SEMANTIC column the provider actually ' +
      'writes, not the row id) `ON DELETE CASCADE`, and the purge deletes ' +
      '`auth.oauth_client WHERE user_id = ?`, so a client the erased user ' +
      'registered takes its resource links with it. Before that reference ' +
      'contract was corrected the key pointed at `oauth_client.id`, which the ' +
      'plugin never writes, so this cascade did not fire and the links would ' +
      'have outlived the client. Nothing to add to the sweep; the dependency is ' +
      'recorded so a future change to either key is read as touching erasure.',
  },
  'system.ai_embeddings': {
    verdict: 'exempt',
    columns: [],
    reason:
      'NO user linkage. `source_type` is only ever `document` or `table` (see ' +
      '`ai/document-sync.ts` and `ai/knowledge-sync.ts`), so an embedding indexes ' +
      'CONTENT, never a person. RESIDUAL, named rather than hidden: an embedding of ' +
      "a table record the erased user authored survives the record's deletion, " +
      'because the purge does not know which record ids it removed. That is the ' +
      'derived-index staleness of `_admin_search_index`, but it belongs on the ' +
      'record-delete path (every deleted record leaks it, not only an erased ' +
      "user's), so it is out of scope here and tracked separately.",
  },
  'system.webhook_deliveries': {
    verdict: 'exempt',
    columns: [],
    reason:
      'NO user column at all — keyed to `webhook_id`, an operator-owned config. ' +
      'RESIDUAL, named: `payload` captures the record verbatim, so a delivery fired ' +
      'by a change to a record the erased user authored retains that content. There ' +
      'is no predicate on this table that identifies the subject, so purging it ' +
      'would mean either deleting every delivery for the whole workspace ' +
      '(over-deletion) or joining back to rows that no longer exist. The correct fix ' +
      "is a delivery retention window, which is the F27 executor's shape, not the " +
      "purge's.",
  },
  'system.file_storage_bytea': {
    verdict: 'cascade',
    columns: [],
    reason:
      'DB-resident file bytes. No user column; `metadata_id` cascades off ' +
      '`file_storage_metadata`, which the purge now deletes, so the bytes go with ' +
      'it. RESIDUAL, named: when `STORAGE_PROVIDER` is local or S3 the bytes live ' +
      'OUTSIDE the database and a transactional DELETE cannot reach them. Removing ' +
      'the metadata row makes them unreferenced but not unlinked; reclaiming them ' +
      'needs an out-of-transaction object-store sweep, tracked separately.',
  },
  'system.record_comments.moderated_by': {
    verdict: 'shed',
    columns: ['moderated_by'],
    reason:
      "Moderating somebody else's comment is an act ON another user's content. " +
      '`ON DELETE SET NULL` sheds the moderator and the comment stands. Keyed ' +
      'separately from the `system.record_comments` delete entry because one table ' +
      'carries two columns with opposite verdicts.',
  },
}

// ─── Export ⊇ erasure ────────────────────────────────────────────────────────

/**
 * Whether the GDPR Art. 15 / 20 export offers a category erasure DELETES.
 *
 * `exported` The export payload carries it today.
 *
 * `withheld` Deliberately absent, and correctly so. Credentials are the whole
 *            of this class: a bearer token or a TOTP secret in a JSON download
 *            is a security defect, not a data-subject right — the export
 *            already withholds passwords and OAuth secrets for this reason.
 *
 * `gap`      Erasure deletes it BECAUSE it is the subject's personal data, and
 *            the export does not offer it. The two therefore contradict each
 *            other, and Art. 15 is the side that loses.
 */
export type ExportStatus = 'exported' | 'withheld' | 'gap'

/**
 * The export status of every category erasure deletes.
 *
 * ── Why a ratchet, not an assertion of zero gaps ─────────────────────────────
 *
 * The honest state today is that the export offers `profile`, `sessions`,
 * `accounts`, `authoredRecords` and `formSubmissions`, while erasure hard-deletes
 * far more — comments, chat transcripts, derived facts, favourites, saved views,
 * row-level grants, the activity feed, uploaded files. Closing that asymmetry
 * means EXPANDING the published export contract in
 * `src/domain/models/api/account/account.ts`, which is a schema-surface decision
 * and not this change's to make.
 *
 * What this map does make impossible is the asymmetry GROWING silently. The
 * guard asserts the set of `gap` entries equals the baseline recorded here, so
 * adding a table to one side only fails the build — which is the regression that
 * actually recurs, and the reason erasure and export drifted this far apart
 * without anyone noticing.
 *
 * Shrinking the set is always allowed: flipping a `gap` to `exported` when the
 * export learns to carry it fails nothing, because the guard compares against
 * this map, and this map is what the implementer edits.
 */
export const EXPORT_COVERAGE: Readonly<Record<string, ExportStatus>> = {
  // Offered today.
  'auth.account': 'exported',
  'system.form_submissions': 'exported',

  // Deliberately withheld — credentials and pure derivations.
  'auth.two_factor': 'withheld',
  'auth.api_key': 'withheld',
  'auth.oauth_access_token': 'withheld',
  'auth.oauth_refresh_token': 'withheld',
  'system.connection_tokens': 'withheld',
  'system._admin_search_index': 'withheld',

  // Erasure deletes these as the subject's data; the export denies they exist.
  'auth.oauth_client': 'gap',
  'auth.oauth_consent': 'gap',
  'auth.member': 'gap',
  'auth.team_member': 'gap',
  'auth.invitation': 'gap',
  'system.activity_logs': 'gap',
  'system.ai_activity_logs': 'gap',
  'system.ai_conversations': 'gap',
  'system.ai_facts': 'gap',
  'system.ai_tool_calls': 'gap',
  'system.comment_read_state': 'gap',
  'system.file_storage_metadata': 'gap',
  'system.record_comments': 'gap',
  'system.user_access': 'gap',
  'system.user_favorites': 'gap',
  'system.user_recent_items': 'gap',
  'system.user_saved_views': 'gap',
  'system.user_table_preferences': 'gap',
}
