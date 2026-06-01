/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { boolean, integer, jsonb, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { users } from '../../../auth/better-auth/schema'
import { systemSchema } from './migration-audit'

export const userSavedViews = systemSchema.table(
  'user_saved_views',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tableName: text('table_name').notNull(),
    name: text('name').notNull(),
    config: jsonb('config').notNull().default({}),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('user_saved_views_user_table_name_idx').on(
      table.userId,
      table.tableName,
      table.name
    ),
  ]
)

export const userTablePreferences = systemSchema.table(
  'user_table_preferences',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tableName: text('table_name').notNull(),
    columnWidths: jsonb('column_widths'),
    columnOrder: jsonb('column_order'),
    rowDensity: text('row_density'),
    defaultViewId: text('default_view_id'),
    frozenColumns: integer('frozen_columns'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('user_table_preferences_user_table_idx').on(table.userId, table.tableName),
  ]
)

export type UserSavedView = typeof userSavedViews.$inferSelect
export type NewUserSavedView = typeof userSavedViews.$inferInsert
export type UserTablePreferences = typeof userTablePreferences.$inferSelect
export type NewUserTablePreferences = typeof userTablePreferences.$inferInsert
