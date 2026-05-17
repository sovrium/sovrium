/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { text, timestamp, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { automationDefinitions } from './automation'
import { systemSchema } from './migration-audit'

/**
 * Automation State Table
 *
 * Persistent key-value store for automation actions (state:set, state:get, state:delete,
 * state:increment, state:list). Each automation can store arbitrary state keyed by string.
 *
 * Features:
 * - Unique constraint on (automationId, key) for upsert semantics
 * - Optional TTL for automatic expiration
 * - JSONB values for flexible data storage
 */
export const automationState = systemSchema.table(
  'automation_state',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    automationId: text('automation_id')
      .notNull()
      .references(() => automationDefinitions.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    value: jsonb('value'),
    ttl: timestamp('ttl', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('automation_state_automation_key_idx').on(table.automationId, table.key),
    index('automation_state_ttl_idx').on(table.ttl),
  ]
)

// Type inference
export type AutomationState = typeof automationState.$inferSelect
export type NewAutomationState = typeof automationState.$inferInsert
