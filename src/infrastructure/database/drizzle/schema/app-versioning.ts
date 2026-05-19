/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { integer, jsonb, serial, text, timestamp } from 'drizzle-orm/pg-core'
import { systemSchema } from './migration-audit'



export const sovriumAppVersions = systemSchema.table('sovrium_app_versions', {
  versionNumber: serial('version_number').primaryKey(),
  snapshot: jsonb('snapshot').notNull(),
  checksum: text('checksum').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  createdByUserId: text('created_by_user_id').notNull(),
  message: text('message').notNull().default(''),
  restoredFromVersion: integer('restored_from_version'),
})

export type SovriumAppVersionRow = typeof sovriumAppVersions.$inferSelect
export type NewSovriumAppVersionRow = typeof sovriumAppVersions.$inferInsert


export const sovriumAppDrafts = systemSchema.table('sovrium_app_drafts', {
  id: text('id').primaryKey().default('singleton'),
  snapshot: jsonb('snapshot').notNull(),
  baseVersion: integer('base_version').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedByUserId: text('updated_by_user_id').notNull(),
})

export type SovriumAppDraftRow = typeof sovriumAppDrafts.$inferSelect
export type NewSovriumAppDraftRow = typeof sovriumAppDrafts.$inferInsert


export const sovriumBootstrapTokens = systemSchema.table('sovrium_bootstrap_tokens', {
  tokenHash: text('token_hash').primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type SovriumBootstrapTokenRow = typeof sovriumBootstrapTokens.$inferSelect
export type NewSovriumBootstrapTokenRow = typeof sovriumBootstrapTokens.$inferInsert


export const sovriumPreviewSessions = systemSchema.table('sovrium_preview_sessions', {
  previewId: text('preview_id').primaryKey(),
  port: integer('port').notNull(),
  draftSnapshot: jsonb('draft_snapshot').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  status: text('status').notNull().default('starting'),
  createdByUserId: text('created_by_user_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type SovriumPreviewSessionRow = typeof sovriumPreviewSessions.$inferSelect
export type NewSovriumPreviewSessionRow = typeof sovriumPreviewSessions.$inferInsert
