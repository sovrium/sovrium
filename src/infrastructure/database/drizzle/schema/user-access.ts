/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { systemSchema } from './migration-audit'

export const userAccess = systemSchema.table('user_access', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: text('user_id').notNull(),
  tableSlug: text('table_slug').notNull(),
  recordIds: text('record_ids').array().notNull(),
  role: text('role').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: text('created_by'),
})
