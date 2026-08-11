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

/**
 * User Saved Views Table (PG-03 / [internal ref])
 *
 * Per-user named view configurations layered ON TOP of developer-configured
 * views in `app.tables[].views[]`. Reuses the same `ViewFiltersSchema` /
 * `ViewSortSchema` / `ViewGroupBySchema` shapes as developer views so the
 * dual-layer view system stays consistent.
 *
 * Scope: strictly per-user; no sharing in v1.
 *
 * The `config` JSONB blob carries the union of:
 *   - `filters?: ViewFilters`
 *   - `sorts?: readonly ViewSort[]`
 *   - `fields?: readonly string[]` (visible-column ordering)
 *   - `groupBy?: ViewGroupBy`
 *   - `baseViewId?: string | number` (when the saved view extends a
 *     developer-configured view rather than starting from scratch)
 *
 * Storing the config as JSONB (vs. denormalized columns) keeps the table
 * forward-compatible with future config primitives without a migration.
 */
export const userSavedViews = systemSchema.table(
  'user_saved_views',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Logical table name (matches `app.tables[].name`). */
    tableName: text('table_name').notNull(),
    name: text('name').notNull(),
    /** ViewFilters | ViewSorts | fields[] | groupBy | baseViewId — JSON blob. */
    config: jsonb('config').notNull().default({}),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Per-user uniqueness on (user, table, name) — matches the user-stories
    // doc constraint and prevents duplicate-name collisions in the UI.
    uniqueIndex('user_saved_views_user_table_name_idx').on(
      table.userId,
      table.tableName,
      table.name
    ),
  ]
)

/**
 * User Table Preferences Table (PG-03 / [internal ref])
 *
 * Per-user, per-table preferences that persist across sessions and devices
 * (server-backed; not local storage). Stores column widths, density,
 * frozen-column count, and the user's default saved view for the table.
 *
 * One row per (user, table) — upserted via `PATCH
 * /api/tables/:tableName/user-preferences`.
 */
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
    /** Map of `columnId -> widthPx`. */
    columnWidths: jsonb('column_widths'),
    /** Ordered list of column IDs (drag-reorder result). */
    columnOrder: jsonb('column_order'),
    /** `'compact' | 'normal' | 'spacious'` — falls back to the schema default. */
    rowDensity: text('row_density'),
    /** Saved view to auto-load (FK kept loose via `text`; resolved at read time). */
    defaultViewId: text('default_view_id'),
    /** Number of leading columns to freeze in scroll views. */
    frozenColumns: integer('frozen_columns'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One preferences row per (user, table); upserts collapse to a single row.
    uniqueIndex('user_table_preferences_user_table_idx').on(table.userId, table.tableName),
  ]
)

// Type inference
export type UserSavedView = typeof userSavedViews.$inferSelect
export type NewUserSavedView = typeof userSavedViews.$inferInsert
export type UserTablePreferences = typeof userTablePreferences.$inferSelect
export type NewUserTablePreferences = typeof userTablePreferences.$inferInsert
