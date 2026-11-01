/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The census of every engine table — `auth`, `system` and `public.audit_log`
 * — and what a reset of the app to its seed does about it.
 *
 * A reset clears what a visitor brought with a hand-kept list of statements
 * (`seed-reset-clear.ts`). A list nobody reconciles against the schema rots
 * silently: a new system table holding visitor data is cleared by nobody, and
 * nothing says so. `seed-reset-coverage.test.ts` walks the LIVE Drizzle schema
 * (both trees) and fails unless every table appears here, and unless every
 * `cleared` entry names the stage that really clears it.
 *
 * ── The four fates ──────────────────────────────────────────────────────────
 *
 * `cleared`    A stage of `RESET_CLEAR_STAGES` deletes its rows (all of them,
 *              or the ones its predicate selects). The entry names the stage.
 * `rebuilt`    Another step of the reset rewrites it: the accounts' erasure
 *              and restore, the sessions' delete, the baselines, the
 *              organisation, or the stored-file sweep. The entry says which.
 * `kept`       Deliberately untouched, with the reason: operator records,
 *              host configuration, migration state.
 * `unreviewed` Not cleared by the reset today, though it may hold what a
 *              visitor did. Kept so the reset's behaviour does not change in
 *              a refactor; each one is an open question about what a reset
 *              should do, not a decision. Moving one to `cleared` is a
 *              behaviour change and goes through the specs.
 */

import type { ClearStageName } from './seed-reset-clear'

/** What a reset does about one engine table. */
export type ResetFate =
  | { readonly fate: 'cleared'; readonly stage: ClearStageName }
  | {
      readonly fate: 'rebuilt'
      readonly by: 'accounts' | 'sessions' | 'baselines' | 'organisation' | 'files'
      readonly how: string
    }
  | { readonly fate: 'kept'; readonly reason: string }
  | { readonly fate: 'unreviewed'; readonly reason: string }

const cleared = (stage: ClearStageName): ResetFate => ({ fate: 'cleared', stage })

const OPERATOR_RECORD =
  'operator record: describes what the instance did, not data a visitor brought'
const AUTOMATION_STATE =
  'operator state of the automations the config declares: runs, schedules, pauses and approvals describe the instance'
const MIGRATION_STATE = 'migration state: the database schema history the engine boots against'

/** Every engine table, as `schema.name`, and its fate under a reset. */
export const RESET_TABLE_FATES: Readonly<Record<string, ResetFate>> = {
  // ── auth ──────────────────────────────────────────────────────────────────
  'auth.account': cleared('sign-in-material'),
  'auth.api_key': cleared('sign-in-material'),
  'auth.device_code': cleared('sign-in-material'),
  'auth.invitation': {
    fate: 'rebuilt',
    by: 'organisation',
    how: 'every invitation is deleted, pending ones included',
  },
  'auth.jwks': {
    fate: 'kept',
    reason: 'host material: the keys the instance signs its tokens with',
  },
  'auth.member': {
    fate: 'rebuilt',
    by: 'organisation',
    how: 'every membership but the host administrators’ is replaced by the one a seed run gives',
  },
  'auth.oauth_access_token': cleared('sign-in-material'),
  'auth.oauth_client': cleared('sign-in-material'),
  'auth.oauth_client_assertion': cleared('sign-in-material'),
  'auth.oauth_client_resource': cleared('sign-in-material'),
  'auth.oauth_consent': cleared('sign-in-material'),
  'auth.oauth_refresh_token': cleared('sign-in-material'),
  'auth.oauth_resource': cleared('unlinked-oauth-resources'),
  'auth.organization': {
    fate: 'rebuilt',
    by: 'organisation',
    how: 'renamed after the app; its id and slug are fixed',
  },
  'auth.passkey': cleared('sign-in-material'),
  'auth.session': {
    fate: 'rebuilt',
    by: 'sessions',
    how: 'every session is deleted when the folder lists its accounts',
  },
  'auth.team': {
    fate: 'rebuilt',
    by: 'organisation',
    how: 'exactly the groups the config declares, with no member',
  },
  'auth.team_member': {
    fate: 'rebuilt',
    by: 'organisation',
    how: 'every team membership is deleted',
  },
  'auth.two_factor': cleared('sign-in-material'),
  'auth.user': {
    fate: 'rebuilt',
    by: 'accounts',
    how: 'unlisted accounts are erased; kept ones return to their baseline and the seed',
  },
  'auth.verification': cleared('sign-in-material'),
  // ── public ────────────────────────────────────────────────────────────────
  'public.audit_log': { fate: 'kept', reason: OPERATOR_RECORD },
  // ── system ────────────────────────────────────────────────────────────────
  'system._admin_search_index': {
    fate: 'unreviewed',
    reason:
      'the operator search index; entries for the records and accounts a reset removes are not cleared by it',
  },
  'system.account_baselines': {
    fate: 'rebuilt',
    by: 'baselines',
    how: 'replaced whole by the baselines of the accounts the reset kept',
  },
  'system.activity_logs': cleared('record-scoped'),
  'system.admin_digest_snapshots': {
    fate: 'kept',
    reason: 'operator record: weekly counts, holding no record value and no identity',
  },
  'system.ai_activity_logs': {
    fate: 'unreviewed',
    reason: 'attributes AI chat turns and agent actions to their actor, a visitor included',
  },
  'system.ai_chat_attachments': cleared('visitor-data'),
  'system.ai_compute_status': cleared('record-scoped'),
  'system.ai_conversations': cleared('visitor-data'),
  'system.ai_embeddings': {
    fate: 'unreviewed',
    reason: 'vectors of the knowledge sources, which may index record content the reset removed',
  },
  'system.ai_facts': {
    fate: 'unreviewed',
    reason:
      'facts an agent learned from conversations, scoped by user; the conversations are cleared',
  },
  'system.ai_field_cache': cleared('record-scoped'),
  'system.ai_knowledge_sources': {
    fate: 'unreviewed',
    reason: 'knowledge-base sources the assistant answers from',
  },
  'system.ai_messages': cleared('visitor-data'),
  'system.ai_tool_calls': cleared('visitor-data'),
  'system.analytics_events': { fate: 'kept', reason: OPERATOR_RECORD },
  'system.automation_approval_requests': { fate: 'kept', reason: AUTOMATION_STATE },
  'system.automation_definitions': { fate: 'kept', reason: AUTOMATION_STATE },
  'system.automation_delayed_steps': { fate: 'kept', reason: AUTOMATION_STATE },
  'system.automation_digest_buckets': {
    fate: 'unreviewed',
    reason:
      'what a digest automation collected before release, which may name records the reset removed',
  },
  'system.automation_digest_items': {
    fate: 'unreviewed',
    reason:
      'what a digest automation collected before release, which may name records the reset removed',
  },
  'system.automation_pauses': { fate: 'kept', reason: AUTOMATION_STATE },
  'system.automation_run_refs': { fate: 'kept', reason: OPERATOR_RECORD },
  'system.automation_run_steps': { fate: 'kept', reason: OPERATOR_RECORD },
  'system.automation_runs': { fate: 'kept', reason: OPERATOR_RECORD },
  'system.automation_scheduled_jobs': { fate: 'kept', reason: AUTOMATION_STATE },
  'system.automation_state': {
    fate: 'unreviewed',
    reason: 'the key-value store the app’s automations write, which visitor-driven runs may fill',
  },
  'system.boot_ledger': { fate: 'kept', reason: OPERATOR_RECORD },
  'system.browser_sessions': {
    fate: 'kept',
    reason: 'host configuration: the sealed cookie jars of the automations’ named browser sessions',
  },
  'system.calendar_feed_tokens': cleared('sign-in-feeds'),
  'system.comment_read_state': cleared('record-scoped'),
  'system.connection_app_tokens': cleared('engine-caches'),
  'system.connection_tokens': {
    fate: 'rebuilt',
    by: 'baselines',
    how: 'every token no baseline holds by its identity is removed; the ones held keep their live values',
  },
  'system.connections': {
    fate: 'kept',
    reason: 'the app’s own connections belong to the installation; every baseline copies them',
  },
  'system.design_system_shares': {
    fate: 'kept',
    reason: 'operator record: the only trace a design publication happened',
  },
  'system.email_messages': {
    fate: 'kept',
    reason: 'operator record: delivery counts under an opaque reference, holding no address',
  },
  'system.email_suppressions': {
    fate: 'kept',
    reason: 'deliverability: an address that bounced or unsubscribed must never be mailed again',
  },
  'system.file_storage_bytea': {
    fate: 'rebuilt',
    by: 'files',
    how: 'a stored file no surviving row names is deleted once the seed is written',
  },
  'system.file_storage_metadata': {
    fate: 'rebuilt',
    by: 'files',
    how: 'a stored file no surviving row names is deleted once the seed is written',
  },
  'system.form_submissions': cleared('visitor-data'),
  'system.links': {
    fate: 'unreviewed',
    reason: 'links minted at runtime; config-declared links are not rows here',
  },
  'system.migration_history': { fate: 'kept', reason: MIGRATION_STATE },
  'system.migration_log': { fate: 'kept', reason: MIGRATION_STATE },
  'system.notification_preferences': cleared('personal-settings'),
  'system.notifications': cleared('personal-settings'),
  'system.read_state': cleared('personal-settings'),
  'system.record_comments': cleared('record-scoped'),
  'system.schema_checksum': { fate: 'kept', reason: MIGRATION_STATE },
  'system.search_index': cleared('record-scoped'),
  'system.search_indexes': {
    fate: 'kept',
    reason: 'nothing in the engine reads or writes it; kept until a migration drops it',
  },
  'system.sovrium_bootstrap_tokens': {
    fate: 'kept',
    reason: 'host material: the one-time first-admin claim',
  },
  'system.user_access': cleared('record-scoped'),
  'system.user_favorites': cleared('personal-settings'),
  'system.user_presence': cleared('personal-settings'),
  'system.user_recent_items': cleared('personal-settings'),
  'system.webhook_configs': {
    fate: 'kept',
    reason: 'operator configuration: the outgoing webhook endpoints, their secrets and events',
  },
  'system.webhook_deliveries': { fate: 'kept', reason: OPERATOR_RECORD },
  'system.webhook_outbox': { fate: 'kept', reason: OPERATOR_RECORD },
  'system.webhook_outbox_subjects': { fate: 'kept', reason: OPERATOR_RECORD },
}
