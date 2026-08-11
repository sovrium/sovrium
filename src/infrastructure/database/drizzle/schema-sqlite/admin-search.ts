/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { text, integer, index, unique } from 'drizzle-orm/sqlite-core'
import { systemTable } from './table-helpers'

/**
 * Admin Global Search Index (SQLite) — sqlite-core mirror of
 * `schema/admin-search.ts`. Backs `GET /api/admin/search?q=` on the zero-config
 * SQLite runtime.
 *
 * ── This is a NEW, SEPARATE table (do NOT confuse with `./search.ts`). ──────
 * The public record-search mirror in `./search.ts` DEGRADES under SQLite
 * (its `content_tsv` column + GIN index are dropped → FTS hard-501s). THIS
 * admin-search index is the opposite: it MUST WORK on SQLite. SQLite ships
 * the FTS5 extension by default in `bun:sqlite`, so the SQLite admin-search
 * path uses an FTS5 virtual table — NO degradation, NO 501.
 *
 * ── Two physical objects make up the SQLite admin search. ──────────────────
 *
 *  1. THIS Drizzle-managed content/shadow table `system__admin_search_index`
 *     (physical name: `system__admin_search_index` via the `system_` prefix +
 *     the `_admin_search_index` logical name). It holds the same column set as
 *     the pg-core table MINUS the `tsvector` column (SQLite has no `tsvector`):
 *     `id, type, entity_id, title, body, href, updated_at`. It is the durable
 *     row store the rebuild upserts into; the unique `(type, entity_id)` keeps
 *     it one-row-per-entity.
 *
 *  2. An FTS5 VIRTUAL TABLE `system__admin_search_fts(title, body, content=...)`
 *     that indexes `title`/`body` for the `MATCH` query. Drizzle's sqlite-core
 *     has no first-class virtual-table builder, so the FTS5 table — and the
 *     INSERT/UPDATE/DELETE sync triggers that keep it in lock-step with the
 *     content table — are created at boot via RAW DDL, dispatched on
 *     `isSqliteRuntime()`. This follows the established DDL-dispatch precedent
 *     in `infrastructure/database/lookup/lookup-view-generators.ts` (which
 *     emits inline `CREATE TRIGGER … INSTEAD OF …` on the SQLite branch and
 *     PL/pgSQL-wrapped triggers on the PG branch). The admin-search repo-live
 * owns that raw DDL ([internal ref]'s job — see the spec + API model). The
 *     SELECT then joins the content table to `…_fts WHERE …_fts MATCH ?`.
 *
 * The PostgreSQL path needs no shadow table: its generated `content_tsv`
 * column + GIN index live ON the table itself. This dialect asymmetry (one
 * table on PG, a content table + an FTS5 vtab on SQLite) is the SAME shape as
 * the lookup-view generators' per-dialect divergence and is invisible above
 * the repository — the use case + API see one logical `admin search` source.
 */

export const adminSearchIndex = systemTable(
  '_admin_search_index',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    /**
     * The entity-kind discriminator. One of: `record`, `submission`, `run`,
     * `user`, `file`, `conversation`, `connection`.
     */
    type: text('type').notNull(),
    entityId: text('entity_id').notNull(),
    /** Secret-free primary label (S4). */
    title: text('title').notNull(),
    /** Secret-free secondary searchable text. */
    body: text('body').notNull().default(''),
    /** Deep-link target the UI navigates to on selection. */
    href: text('href').notNull(),
    // SQLite: no `content_tsv tsvector` column — the FTS5 virtual table
    // `system__admin_search_fts` (raw-DDL-created at boot) indexes title/body.
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    // SQLite: no GIN tsvector index — the FTS5 vtab MATCH replaces it.
    index('idx_admin_search_type').on(table.type),
    unique('admin_search_type_entity_unique').on(table.type, table.entityId),
  ]
)

// Type inference
export type AdminSearchIndexRow = typeof adminSearchIndex.$inferSelect
export type NewAdminSearchIndexRow = typeof adminSearchIndex.$inferInsert
