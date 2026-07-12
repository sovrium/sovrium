/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { text, timestamp, serial, customType, index, unique } from 'drizzle-orm/pg-core'
import { systemSchema } from './migration-audit'


const tsvector = (name: string) =>
  customType<{ data: string }>({
    dataType() {
      return 'tsvector'
    },
  })(name)

export const adminSearchIndex = systemSchema.table(
  '_admin_search_index',
  {
    id: serial('id').primaryKey(),
    type: text('type').notNull(),
    entityId: text('entity_id').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull().default(''),
    href: text('href').notNull(),
    contentTsv: tsvector('content_tsv')
      .notNull()
      .generatedAlwaysAs(
        sql`to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(body, ''))`
      ),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_admin_search_tsv').using('gin', table.contentTsv),
    index('idx_admin_search_type').on(table.type),
    unique('admin_search_type_entity_unique').on(table.type, table.entityId),
  ]
)

export type AdminSearchIndexRow = typeof adminSearchIndex.$inferSelect
export type NewAdminSearchIndexRow = typeof adminSearchIndex.$inferInsert
