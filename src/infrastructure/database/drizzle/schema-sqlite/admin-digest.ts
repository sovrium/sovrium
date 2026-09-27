/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { index, integer, text } from 'drizzle-orm/sqlite-core'
import { systemTable } from './table-helpers'

/**
 * SQLite mirror of `system.admin_digest_snapshots` (see `schema/admin-digest.ts`
 * for what each column means). Instants are epoch milliseconds and the digest
 * document is JSON text.
 */
export const adminDigestSnapshots = systemTable(
  'admin_digest_snapshots',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    periodStart: integer('period_start', { mode: 'timestamp_ms' }).notNull(),
    periodEnd: integer('period_end', { mode: 'timestamp_ms' }).notNull(),
    sentAt: integer('sent_at', { mode: 'timestamp_ms' }),
    recipientCount: integer('recipient_count').notNull().default(0),
    metrics: text('metrics', { mode: 'json' }).notNull(),
  },
  (table) => [index('admin_digest_snapshots_period_end_idx').on(table.periodEnd)]
)
