/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { index, integer, jsonb, text, timestamp } from 'drizzle-orm/pg-core'
import { systemSchema } from './migration-audit'

/**
 * `system.admin_digest_snapshots` — one row per weekly summary the instance
 * computed.
 *
 * The row is what the NEXT summary compares itself against: its `period_end`
 * is where the next period starts, and its `metrics` (a version-1
 * `WeeklyDigest` document, decoded by `weeklyDigestSchema`) carry the row
 * counts and sizes the change figures are measured from. Counts only — the
 * document holds no record value and no identity, which is also why nothing
 * here references a user and nothing here is erased with an account.
 *
 * `sent_at` is NULL when the summary was computed but its delivery failed; the
 * boot catch-up retries that one while its period is recent. `recipient_count`
 * says how many addresses it went to.
 */
export const adminDigestSnapshots = systemSchema.table(
  'admin_digest_snapshots',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    /** Start of the period the summary covers, inclusive. */
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    /** End of the period, exclusive — where the next summary starts. */
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    /** When the email went out; NULL when delivery failed. */
    sentAt: timestamp('sent_at', { withTimezone: true }),
    /** How many addresses the summary was sent to. */
    recipientCount: integer('recipient_count').notNull().default(0),
    /** The version-1 digest document. */
    metrics: jsonb('metrics').notNull(),
  },
  (table) => [index('admin_digest_snapshots_period_end_idx').on(table.periodEnd)]
)

export type AdminDigestSnapshotRow = typeof adminDigestSnapshots.$inferSelect
