/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { text, integer, index } from 'drizzle-orm/sqlite-core'
import { users } from './auth-tables'
import { systemTable } from './table-helpers'

export const shareLinks = systemTable(
  'share_links',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    pageName: text('page_name').notNull(),
    token: text('token').notNull().unique(),
    passwordHash: text('password_hash'),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
    embedAllowed: integer('embed_allowed', { mode: 'boolean' }).notNull().default(true),
    createdById: text('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
    viewCount: integer('view_count').notNull().default(0),
    lastAccessedAt: integer('last_accessed_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    index('share_links_pageName_idx').on(table.pageName),
    index('share_links_createdById_idx').on(table.createdById),
  ]
)

export type ShareLink = typeof shareLinks.$inferSelect
export type NewShareLink = typeof shareLinks.$inferInsert
