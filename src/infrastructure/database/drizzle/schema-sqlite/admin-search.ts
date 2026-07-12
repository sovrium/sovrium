/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { text, integer, index, unique } from 'drizzle-orm/sqlite-core'
import { systemTable } from './table-helpers'


export const adminSearchIndex = systemTable(
  '_admin_search_index',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    type: text('type').notNull(),
    entityId: text('entity_id').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull().default(''),
    href: text('href').notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index('idx_admin_search_type').on(table.type),
    unique('admin_search_type_entity_unique').on(table.type, table.entityId),
  ]
)

export type AdminSearchIndexRow = typeof adminSearchIndex.$inferSelect
export type NewAdminSearchIndexRow = typeof adminSearchIndex.$inferInsert
