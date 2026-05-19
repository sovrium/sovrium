/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { text, timestamp, boolean, integer, index } from 'drizzle-orm/pg-core'
import { users } from '../../../auth/better-auth/schema'
import { systemSchema } from './migration-audit'

export const shareLinks = systemSchema.table(
  'share_links',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    pageName: text('page_name').notNull(),
    token: text('token').notNull().unique(),
    passwordHash: text('password_hash'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    embedAllowed: boolean('embed_allowed').notNull().default(true),
    createdById: text('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    viewCount: integer('view_count').notNull().default(0),
    lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true }),
  },
  (table) => [
    index('share_links_pageName_idx').on(table.pageName),
    index('share_links_createdById_idx').on(table.createdById),
  ]
)

export type ShareLink = typeof shareLinks.$inferSelect
export type NewShareLink = typeof shareLinks.$inferInsert
