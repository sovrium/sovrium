/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { index, sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const auditLog = sqliteTable(
  'audit_log',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    action: text('action').notNull(),

    actorId: text('actor_id'),

    metadata: text('metadata', { mode: 'json' }),

    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index('audit_log_action_idx').on(table.action),
    index('audit_log_actor_id_idx').on(table.actorId),
    index('audit_log_created_at_idx').on(table.createdAt),
  ]
)

export type AuditLog = typeof auditLog.$inferSelect
export type NewAuditLog = typeof auditLog.$inferInsert
