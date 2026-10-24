/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The per-person stores erasure DELETES from: each row is about one person
 * only — what she bookmarked, the feed addresses she minted, what she browsed,
 * how far she read, when she was last seen, the notifications she received,
 * the channels she chose for them, and the baseline a seed reset restores her
 * account to. Every one cascades off `auth.user`, and is
 * named anyway, so the enumeration answers "what does erasure delete?".
 *
 * Spread into `PURGED_SYSTEM_TABLES` (`account-purge-coverage.ts`), whose
 * entries `purgeAccount` sweeps with `DELETE FROM <table> WHERE <column> = <userId>`.
 */
export const PERSONAL_STORE_TABLES = [
  { table: 'user_favorites', column: 'user_id', reason: 'Per-user bookmarks. Cascades; named.' },
  { table: 'calendar_feed_tokens', column: 'user_id', reason: 'Feed addresses. Cascades; named.' },
  {
    table: 'read_state',
    column: 'user_id',
    reason: 'How far the person has read each channel — a behavioural trail. Cascades; named.',
  },
  {
    table: 'user_presence',
    column: 'user_id',
    reason: 'When the person was last seen — a behavioural trail. Cascades; named.',
  },
  {
    table: 'notifications',
    column: 'recipient_id',
    reason: 'The notifications the person received. Cascades; named.',
  },
  {
    table: 'notification_preferences',
    column: 'user_id',
    reason: 'The notification channels the person chose. Cascades; named.',
  },
  {
    table: 'account_baselines',
    column: 'user_id',
    reason:
      'The copy of the profile, sign-in rows, OAuth clients and connected accounts a seed reset returns a kept account to. Cascades; named.',
  },
  {
    table: 'user_recent_items',
    column: 'user_id',
    reason: 'Per-user browsing history — a behavioural trail. Cascades; named.',
  },
] as const
