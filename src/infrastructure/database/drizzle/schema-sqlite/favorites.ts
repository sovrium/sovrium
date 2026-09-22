/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { text, integer, index } from 'drizzle-orm/sqlite-core'
import { users } from './auth-tables'
import { systemTable } from './table-helpers'

/**
 * Favorites tables — sqlite-core mirror of `schema/favorites.ts`.
 */

/**
 * User Favorites Table
 *
 * Tracks user-bookmarked entities (records, pages). Supports soft delete
 * for unfavorite/refavorite semantics.
 *
 * Entity types: 'record', 'page'
 */
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

/**
 * User Recent Items Table
 *
 * Tracks recently viewed entities per user. Upsert on re-visit (updates viewedAt).
 * Application layer enforces max 20 items per user and 30-day auto-prune.
 *
 * Entity types: 'record', 'page'
 */
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

// Type inference
