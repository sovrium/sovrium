/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { integer, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { users } from './auth-tables'
import { systemTable } from './table-helpers'

export const userSavedViews = systemTable(
  'user_saved_views',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tableName: text('table_name').notNull(),
    name: text('name').notNull(),
    config: text('config').notNull().default('{}'),
    isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex('user_saved_views_user_table_name_idx').on(
      table.userId,
      table.tableName,
      table.name
    ),
  ]
)

export const userTablePreferences = systemTable(
  'user_table_preferences',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tableName: text('table_name').notNull(),
    columnWidths: text('column_widths'),
    columnOrder: text('column_order'),
    rowDensity: text('row_density'),
    defaultViewId: text('default_view_id'),
    frozenColumns: integer('frozen_columns'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex('user_table_preferences_user_table_idx').on(table.userId, table.tableName),
  ]
)

export type UserSavedView = typeof userSavedViews.$inferSelect
export type NewUserSavedView = typeof userSavedViews.$inferInsert
export type UserTablePreferences = typeof userTablePreferences.$inferSelect
export type NewUserTablePreferences = typeof userTablePreferences.$inferInsert
