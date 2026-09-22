/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { automationDefinitions } from './automation'
import { systemTable } from './table-helpers'

/**
 * Automation State Table — sqlite-core mirror of `schema/automation-state.ts`.
 *
 * Persistent key-value store for automation actions (state:set, state:get, state:delete,
 * state:increment, state:list). Each automation can store arbitrary state keyed by string.
 *
 * Features:
 * - Unique constraint on (automationId, key) for upsert semantics
 * - Optional TTL for automatic expiration
 * - JSON values for flexible data storage
 */
export const automationState = systemTable(
  'automation_state',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    automationId: text('automation_id')
      .notNull()
      .references(() => automationDefinitions.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    value: text('value', { mode: 'json' }),
    ttl: integer('ttl', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('automation_state_automation_key_idx').on(table.automationId, table.key),
    index('automation_state_ttl_idx').on(table.ttl),
  ]
)

// Type inference
