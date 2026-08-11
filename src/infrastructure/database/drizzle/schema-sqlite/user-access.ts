/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { text, integer } from 'drizzle-orm/sqlite-core'
import { systemTable } from './table-helpers'

/**
 * Drizzle schema for the multi-tenant `user_access` junction table (Z-2) —
 * sqlite-core mirror of `schema/user-access.ts`.
 *
 * The DDL is engine-managed — created by `schema-initializer.ts` at startup
 * whenever `auth.scopeTables` is configured. This Drizzle mapping mirrors that
 * DDL so we can use Drizzle for type-safe inserts/selects.
 *
 * pg uses a `uuid` primary key; SQLite has no `uuid` type, so this uses
 * `text('id')` with an app-side `crypto.randomUUID()` default (pg used a
 * DB-side `gen_random_uuid()`). The `text[]` `record_ids` column maps to a
 * JSON-encoded `text({ mode: 'json' })` array.
 */
export const userAccess = systemTable('user_access', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull(),
  tableSlug: text('table_slug').notNull(),
  /**
   * Non-empty list of record-id strings/UUIDs the user has access to within
   * `tableSlug`. Modelled as a JSON array (pg used TEXT[]) so callers can pass
   * arbitrary string keys (e.g. 'c1') without forcing a UUID format.
   */
  recordIds: text('record_ids', { mode: 'json' }).$type<string[]>().notNull(),
  role: text('role').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
  createdBy: text('created_by'),
})
