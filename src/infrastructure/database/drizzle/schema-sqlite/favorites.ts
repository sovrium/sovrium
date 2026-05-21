/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { text, integer, index } from 'drizzle-orm/sqlite-core'
import { users } from './auth-tables'
import { systemTable } from './table-helpers'


export const userFavorites = systemTable(
  'user_favorites',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    tableId: text('table_id'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    index('user_favorites_user_entity_idx').on(table.userId, table.entityType, table.entityId),
    index('user_favorites_deletedAt_idx').on(table.deletedAt),
  ]
)

export const userRecentItems = systemTable(
  'user_recent_items',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    tableId: text('table_id'),
    viewedAt: integer('viewed_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index('user_recent_items_user_viewedAt_idx').on(table.userId, table.viewedAt)]
)

export type UserFavorite = typeof userFavorites.$inferSelect
export type NewUserFavorite = typeof userFavorites.$inferInsert
export type UserRecentItem = typeof userRecentItems.$inferSelect
export type NewUserRecentItem = typeof userRecentItems.$inferInsert
