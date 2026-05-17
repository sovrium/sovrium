/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { integer, jsonb, serial, text, timestamp } from 'drizzle-orm/pg-core'
import { systemSchema } from './migration-audit'

/**
 * App Versioning Tables — Programmatic Schema Editing Foundation
 *
 * Four tables in `pgSchema('system')` backing the runtime-editable App
 * configuration:
 *
 *   1. sovrium_app_versions      — append-only audit log of immutable
 *                                  schema snapshots
 *   2. sovrium_app_drafts        — singleton-per-app working copy
 *   3. sovrium_bootstrap_tokens  — one-time first-admin claim tokens
 *   4. sovrium_preview_sessions  — ephemeral sandbox runtime descriptors
 *
 * These tables are **infrastructure-only** — they are NOT exposed
 * through the user-facing MCP enumeration in
 * `domain/models/shared/internal-tables.ts`. The schema-editing API
 * surface (Phase 3) is the only way to read/write them.
 *
 * No `restoredFromVersion` foreign-key is declared back into
 * `sovrium_app_versions` to keep the migration self-contained and
 * avoid ON DELETE cascade surprises (versions are never deleted, but
 * the FK would force migration ordering anyway). The application
 * layer enforces the integer points to a real prior version.
 */

// ---------------------------------------------------------------------------
// system.sovrium_app_versions — immutable schema snapshot history
// ---------------------------------------------------------------------------

export const sovriumAppVersions = systemSchema.table('sovrium_app_versions', {
  versionNumber: serial('version_number').primaryKey(),
  /** Encoded App schema (output of Schema.encode(AppSchema)). */
  snapshot: jsonb('snapshot').notNull(),
  checksum: text('checksum').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  /**
   * Better Auth user id (text). No FK declared because the auth schema
   * lives in a different pgSchema and we want this migration to be
   * self-contained — referential integrity is enforced by the
   * application layer (only authenticated admins can publish).
   */
  createdByUserId: text('created_by_user_id').notNull(),
  message: text('message').notNull().default(''),
  /** Set only when this version was produced by a `restore` of an older one. */
  restoredFromVersion: integer('restored_from_version'),
})

export type SovriumAppVersionRow = typeof sovriumAppVersions.$inferSelect
export type NewSovriumAppVersionRow = typeof sovriumAppVersions.$inferInsert

// ---------------------------------------------------------------------------
// system.sovrium_app_drafts — singleton mutable working copy
// ---------------------------------------------------------------------------

/**
 * Phase 1 pins this to a single row keyed by id='singleton'. Multi-tenant
 * support (one draft per Sovrium *app instance*) can be added in a future
 * migration by changing the PK to `(app_id)` once that concept exists.
 */
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

// ---------------------------------------------------------------------------
// system.sovrium_bootstrap_tokens — one-time first-admin claim
// ---------------------------------------------------------------------------

/**
 * Plaintext is NEVER stored. The `tokenHash` column holds the SHA-256
 * hex digest (64 chars) of the plaintext token printed to stdout once
 * at server boot.
 */
export const sovriumBootstrapTokens = systemSchema.table('sovrium_bootstrap_tokens', {
  tokenHash: text('token_hash').primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type SovriumBootstrapTokenRow = typeof sovriumBootstrapTokens.$inferSelect
export type NewSovriumBootstrapTokenRow = typeof sovriumBootstrapTokens.$inferInsert

// ---------------------------------------------------------------------------
// system.sovrium_preview_sessions — ephemeral sandbox runtime
// ---------------------------------------------------------------------------

export const sovriumPreviewSessions = systemSchema.table('sovrium_preview_sessions', {
  previewId: text('preview_id').primaryKey(),
  port: integer('port').notNull(),
  /** Encoded App snapshot (same shape as sovrium_app_versions.snapshot). */
  draftSnapshot: jsonb('draft_snapshot').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  /**
   * Lifecycle: 'starting' → 'running' → 'stopped'
   *                       ↘──────────→ 'expired' (TTL-driven)
   */
  status: text('status').notNull().default('starting'),
  createdByUserId: text('created_by_user_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type SovriumPreviewSessionRow = typeof sovriumPreviewSessions.$inferSelect
export type NewSovriumPreviewSessionRow = typeof sovriumPreviewSessions.$inferInsert
