/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { pgTable, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { users } from '../../../auth/better-auth/schema'

export const auditLog = pgTable(
  'audit_log',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),

    action: text('action').notNull(),

    actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }),
    actorType: text('actor_type').notNull(),
    actorRole: text('actor_role').notNull(),
    actorEmail: text('actor_email'),

    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id').notNull(),
    resourceName: text('resource_name'),

    severity: text('severity').notNull(),
    result: text('result').notNull(),

    transport: text('transport').notNull().default('api'),

    metadata: jsonb('metadata'),
  },
  (table) => [
    index('audit_log_action_idx').on(table.action),
    index('audit_log_actor_id_idx').on(table.actorId),
    index('audit_log_created_at_idx').on(table.createdAt),
    index('audit_log_severity_idx').on(table.severity),
    index('audit_log_result_idx').on(table.result),
    index('audit_log_resource_type_idx').on(table.resourceType),
    index('audit_log_transport_idx').on(table.transport),
  ]
)

export type AuditLogRow = typeof auditLog.$inferSelect
export type NewAuditLogRow = typeof auditLog.$inferInsert
