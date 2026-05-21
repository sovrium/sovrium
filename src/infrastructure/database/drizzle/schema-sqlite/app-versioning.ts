/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { integer, text } from 'drizzle-orm/sqlite-core'
import { systemTable } from './table-helpers'



export const sovriumAppVersions = systemTable('sovrium_app_versions', {
  versionNumber: integer('version_number').primaryKey({ autoIncrement: true }),
  snapshot: text('snapshot', { mode: 'json' }).notNull(),
  checksum: text('checksum').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
  createdByUserId: text('created_by_user_id').notNull(),
  source: text('source').notNull().default('config-file'),
  fileChecksum: text('file_checksum'),
  message: text('message').notNull().default(''),
  restoredFromVersion: integer('restored_from_version'),
})

export type SovriumAppVersionRow = typeof sovriumAppVersions.$inferSelect
export type NewSovriumAppVersionRow = typeof sovriumAppVersions.$inferInsert


export const sovriumAppDrafts = systemTable('sovrium_app_drafts', {
  id: text('id').primaryKey().default('singleton'),
  snapshot: text('snapshot', { mode: 'json' }).notNull(),
  baseVersion: integer('base_version').notNull().default(0),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedByUserId: text('updated_by_user_id').notNull(),
})

export type SovriumAppDraftRow = typeof sovriumAppDrafts.$inferSelect
export type NewSovriumAppDraftRow = typeof sovriumAppDrafts.$inferInsert


export const sovriumBootstrapTokens = systemTable('sovrium_bootstrap_tokens', {
  tokenHash: text('token_hash').primaryKey(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  usedAt: integer('used_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
})

export type SovriumBootstrapTokenRow = typeof sovriumBootstrapTokens.$inferSelect
export type NewSovriumBootstrapTokenRow = typeof sovriumBootstrapTokens.$inferInsert


export const sovriumPreviewSessions = systemTable('sovrium_preview_sessions', {
  previewId: text('preview_id').primaryKey(),
  port: integer('port').notNull(),
  draftSnapshot: text('draft_snapshot', { mode: 'json' }).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  status: text('status').notNull().default('starting'),
  createdByUserId: text('created_by_user_id').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
})

export type SovriumPreviewSessionRow = typeof sovriumPreviewSessions.$inferSelect
export type NewSovriumPreviewSessionRow = typeof sovriumPreviewSessions.$inferInsert
