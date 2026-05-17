/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { systemSchema } from './migration-audit'

/**
 * Drizzle schema for the multi-tenant `user_access` junction table (Z-2).
 *
 * The DDL is engine-managed — created by `schema-initializer.ts` at startup
 * whenever `auth.scopeTables` is configured (see
 * `src/infrastructure/database/schema/user-access-table.ts`). This Drizzle
 * mapping mirrors that DDL exactly so we can use Drizzle for type-safe
 * inserts/selects from the live repository.
 *
 * Lives in the `system` schema alongside the other engine-managed tables
 * (see `docs/architecture/patterns/internal-table-naming-convention.md`).
 */
export const userAccess = systemSchema.table('user_access', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: text('user_id').notNull(),
  tableSlug: text('table_slug').notNull(),
  /**
   * Non-empty list of record-id strings/UUIDs the user has access to within
   * `tableSlug`. Modelled as TEXT[] (matches the DDL) so callers can pass
   * arbitrary string keys (e.g. 'c1') without forcing a UUID format.
   */
  recordIds: text('record_ids').array().notNull(),
  role: text('role').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: text('created_by'),
})
