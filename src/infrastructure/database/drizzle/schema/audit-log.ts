/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { jsonb, pgTable, text, timestamp, index } from 'drizzle-orm/pg-core'

export const auditLog = pgTable(
  'audit_log',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    action: text('action').notNull(),

    actorId: text('actor_id'),

    metadata: jsonb('metadata'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('audit_log_action_idx').on(table.action),
    index('audit_log_actor_id_idx').on(table.actorId),
    index('audit_log_created_at_idx').on(table.createdAt),
  ]
)

export type AuditLog = typeof auditLog.$inferSelect
export type NewAuditLog = typeof auditLog.$inferInsert
