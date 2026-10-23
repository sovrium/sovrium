/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The export side of the erasure census in `account-purge-coverage.ts`: for
 * every category erasure deletes, whether the data export offers it.
 */

// ─── Export ⊇ erasure ────────────────────────────────────────────────────────

/**
 * Whether the GDPR Art. 15 / 20 export offers a category erasure DELETES.
 *
 * `exported` The export payload carries it today.
 * `withheld` Deliberately absent: credentials only. A bearer token, a TOTP secret or
 *            a passkey in a JSON download is a security defect, not a data-subject
 *            right — as with the passwords and OAuth secrets already withheld.
 * `gap`      Erasure deletes it AS the subject's personal data, and the export
 *            does not offer it: the two contradict, and Art. 15 is the side that loses.
 */
export type ExportStatus = 'exported' | 'withheld' | 'gap'

/**
 * The export status of every category erasure deletes.
 *
 * ── Why a ratchet, not an assertion of zero gaps ─────────────────────────────
 *
 * The honest state today is that the export offers the profile, sessions, accounts, authored
 * records, form submissions, audit acts, chat files, the AI footprint, favourites and recent
 * items, while erasure still hard-deletes more — comments, row-level grants, the activity feed,
 * uploaded files. Closing that asymmetry means EXPANDING the published export contract in
 * `src/domain/models/api/account/account.ts`, which is a schema-surface decision and not this
 * change's to make.
 *
 * What this map does make impossible is the asymmetry GROWING silently. The guard asserts the set
 * of `gap` entries equals the baseline recorded here, so adding a table to one side only fails the
 * build — which is the regression that actually recurs, and the reason erasure and export drifted
 * this far apart without anyone noticing.
 *
 * Shrinking the set is always allowed: flipping a `gap` to `exported` when the export learns to
 * carry it fails nothing, because the guard compares against this map, and this map is what the
 * implementer edits.
 */
export const EXPORT_COVERAGE: Readonly<Record<string, ExportStatus>> = {
  // Offered today.
  'auth.account': 'exported',
  'system.form_submissions': 'exported',
  'system.ai_chat_attachments': 'exported',
  'system.ai_activity_logs': 'exported',
  'system.ai_conversations': 'exported',
  'system.ai_facts': 'exported',
  'system.ai_tool_calls': 'exported',
  'system.user_favorites': 'exported',
  'system.user_recent_items': 'exported',
  'system.read_state': 'exported',
  'system.user_presence': 'exported',
  'system.notifications': 'exported',
  'system.notification_preferences': 'exported',

  // Deliberately withheld — credentials and pure derivations.
  'auth.two_factor': 'withheld',
  'auth.passkey': 'withheld',
  'auth.verification': 'withheld',
  'auth.api_key': 'withheld',
  'auth.oauth_access_token': 'withheld',
  'auth.oauth_refresh_token': 'withheld',
  'system.connection_tokens': 'withheld',
  'system.calendar_feed_tokens': 'withheld',
  'system._admin_search_index': 'withheld',
  'system.webhook_outbox_subjects': 'withheld',

  // Erasure deletes these as the subject's data; the export denies they exist.
  'auth.oauth_client': 'gap',
  'auth.oauth_consent': 'gap',
  'auth.member': 'gap',
  'auth.team_member': 'gap',
  'auth.invitation': 'gap',
  'system.activity_logs': 'gap',
  'system.comment_read_state': 'gap',
  'system.file_storage_metadata': 'gap',
  'system.record_comments': 'gap',
  'system.user_access': 'gap',
}
