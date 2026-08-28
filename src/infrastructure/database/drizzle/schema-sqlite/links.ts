/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { index, integer, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { systemTable } from './table-helpers'

/**
 * sqlite-core mirror of `schema/links.ts` — physical table `system_links`.
 *
 * Every exported identifier matches the pg-core module so the runtime barrel
 * swap stays transparent to importers. See the pg module for why this table
 * carries no click counters.
 */
export const links = systemTable(
  'links',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    appName: text('app_name').notNull().default('default'),
    slug: text('slug').notNull(),
    source: text('source').notNull().default('db'),
    destination: text('destination'),
    targets: text('targets', { mode: 'json' }),
    title: text('title'),
    tags: text('tags', { mode: 'json' }).notNull().default([]),
    notes: text('notes'),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    validFrom: integer('valid_from', { mode: 'timestamp_ms' }),
    validUntil: integer('valid_until', { mode: 'timestamp_ms' }),
    maxClicks: integer('max_clicks'),
    expiredTo: text('expired_to'),
    utm: text('utm', { mode: 'json' }),
    passwordHash: text('password_hash'),
    disabledAt: integer('disabled_at', { mode: 'timestamp_ms' }),
    shadowedAt: integer('shadowed_at', { mode: 'timestamp_ms' }),
    archivedAt: integer('archived_at', { mode: 'timestamp_ms' }),
    createdBy: text('created_by'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    // SQLite supports partial indexes, so the soft-delete predicate carries over
    // unchanged — a re-mintable slug behaves identically on both engines.
    uniqueIndex('links_app_slug_unique')
      .on(table.appName, table.slug)
      .where(sql`deleted_at IS NULL`),
    index('links_app_archived_idx').on(table.appName, table.archivedAt),
    index('links_deleted_at_idx').on(table.deletedAt),
  ]
)

export type Link = typeof links.$inferSelect
export type NewLink = typeof links.$inferInsert
