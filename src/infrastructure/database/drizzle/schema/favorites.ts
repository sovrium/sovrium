/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { text, timestamp, index } from 'drizzle-orm/pg-core'
import { users } from '../../../auth/better-auth/schema'
import { systemSchema } from './migration-audit'

/**
 * User Favorites Table
 *
 * Tracks user-bookmarked entities (records, pages). Supports soft delete
 * for unfavorite/refavorite semantics.
 *
 * Entity types: 'record', 'page'
 */
export const userFavorites = systemSchema.table(
  'user_favorites',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    tableId: text('table_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('user_favorites_user_entity_idx').on(table.userId, table.entityType, table.entityId),
    index('user_favorites_deletedAt_idx').on(table.deletedAt),
  ]
)

/**
 * User Recent Items Table
 *
 * Tracks recently viewed entities per user. Upsert on re-visit (updates viewedAt).
 * Application layer enforces max 20 items per user and 30-day auto-prune.
 *
 * Entity types: 'record', 'page'
 */
export const userRecentItems = systemSchema.table(
  'user_recent_items',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    tableId: text('table_id'),
    viewedAt: timestamp('viewed_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('user_recent_items_user_viewedAt_idx').on(table.userId, table.viewedAt)]
)

// Type inference
export type UserFavorite = typeof userFavorites.$inferSelect
export type NewUserFavorite = typeof userFavorites.$inferInsert
export type UserRecentItem = typeof userRecentItems.$inferSelect
export type NewUserRecentItem = typeof userRecentItems.$inferInsert
