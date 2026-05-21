/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { text, integer } from 'drizzle-orm/sqlite-core'
import { systemTable } from './table-helpers'

export const userAccess = systemTable('user_access', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull(),
  tableSlug: text('table_slug').notNull(),
  recordIds: text('record_ids', { mode: 'json' }).$type<string[]>().notNull(),
  role: text('role').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
  createdBy: text('created_by'),
})
