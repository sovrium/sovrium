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

/**
 * Pass-through jsonb column — physically `jsonb`, but with identity
 * `toDriver`/`fromDriver` mappers that bypass Drizzle's default JSON
 * stringify/parse round-trip.
 *
 * Why: Drizzle's stock `jsonb()` calls `JSON.stringify(value)` on write and
 * `JSON.parse(value)` on read. Under `bun:sql`, this conflicts with bun:sql's
 * own jsonb (de)serializer — both layers JSON-encode/decode, producing a
 * double-encode on write and an over-unwrap on read. The atomic
 * `increment` path's `value #>> '{}'` only unwraps one layer and breaks.
 *
 * The repository writes through `${JSON.stringify(value)}::text::jsonb` for
 * a single text-cast encoding (see `encodeJsonbValue` in
 * `automation-state-repository-live.ts`). On read, bun:sql returns the
 * value already JSON-parsed; identity `fromDriver` keeps it intact.
 *
 * `dataType()` returns `'jsonb'` so the physical column type, indexes, and
 * Drizzle-Kit migration introspection remain identical to the stock
 * `jsonb()`. SQLite has no analogous double-encode (Drizzle's
 * `text(mode:'json')` round-trips cleanly) so its mirror keeps the
 * standard `text(...,{mode:'json'})` column.
 *
 * for the runtime probe
 * diagnostics that pinned down the double-encoding.
 */
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

// Type inference
export type AutomationState = typeof automationState.$inferSelect
export type NewAutomationState = typeof automationState.$inferInsert
