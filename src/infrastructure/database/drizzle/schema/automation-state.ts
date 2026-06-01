/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { text, timestamp, customType, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { automationDefinitions } from './automation'
import { systemSchema } from './migration-audit'

const jsonbRaw = customType<{ data: unknown; driverData: unknown }>({
  dataType() {
    return 'jsonb'
  },
  toDriver(value) {
    return value
  },
  fromDriver(value) {
    return value
  },
})

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
    value: jsonbRaw('value'),
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

export type AutomationState = typeof automationState.$inferSelect
export type NewAutomationState = typeof automationState.$inferInsert
