/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { text, timestamp, serial, customType, index, unique } from 'drizzle-orm/pg-core'
import { systemSchema } from './migration-audit'

/**
 * Admin Global Search Index (PostgreSQL) — [internal ref].
 *
 * THE BACKING STORE FOR `GET /api/admin/search?q=` — the admin-only, FULLY
 * INDEXED global search that spans EVERY admin entity kind in one query:
 * table records, form submissions, automation runs, users, file names, agent
 * conversations, and connections.
 *
 * ── This is a NEW, SEPARATE table. ────────────────────────────────────────
 * It deliberately does NOT reuse, alter, or share rows with the existing
 * public record-search tables `search_index` / `search_indexes`
 * (`./search.ts`). Those index ONLY user-table records (one `tsvector` row per
 * record, maintained by `fts-manager.ts`) and degrade to a hard
 * `501 requires-postgres` under SQLite. THIS table is the operator-console
 * cross-entity index: it is heterogeneous (a `type` discriminator column), it
 * works on BOTH dialects (FTS5 on SQLite — see the sqlite-core mirror), and it
 * is populated from each entity's EXISTING admin read paths, not from the
 * per-record FTS writer. Keeping them separate means the proven public-search
 * FTS pipeline is never touched by admin-search work.
 *
 * ── Column-promotion design (why these columns). ───────────────────────────
 * Rather than a single opaque JSON blob, the searchable + projectable fields
 * are first-class columns so the query stays a simple parameter-bound SELECT:
 *
 *   - `type`        the entity kind discriminator — one of:
 *                   `record | submission | run | user | file | conversation |
 *                   connection`. Indexed so a future type-scoped query
 *                   (`?q=…&type=user`) is cheap, and so per-type result
 *                   grouping in the API is a stable sort key.
 *   - `entity_id`   the source entity's id (TEXT — heterogeneous across kinds:
 *                   record ids, submission ids, user ids, connection ids, …),
 *                   carried verbatim into the deep-link `href`.
 *   - `title`       the human label shown as the result's primary line — ALWAYS
 *                   SECRET-FREE (a connection's NAME/label, a file's NAME, a
 *                   user's e-mail/display label, a record's first text column).
 *                   NEVER a token, credential, or raw secret (S4).
 *   - `body`        the secondary searchable text (a record's other text
 *                   columns, a submission's payload preview, a run's error
 *                   summary, a conversation's first-message snippet). Also
 *                   secret-free. The FTS document is `title || ' ' || body`.
 *   - `href`        the deep-link the UI navigates to when the result is
 *                   selected (e.g. `/_admin/tables/{name}?record={id}`,
 *                   `/_admin/connections`). Stored, never recomputed client-side.
 *   - `updated_at`  the source entity's last-touch time, surfaced for ordering
 *                   (most-recent first within a type group) and freshness.
 *
 * ── Full-text search (PostgreSQL path). ────────────────────────────────────
 * A generated `content_tsv tsvector` column over `title || ' ' || body` backs
 * the `@@` match, with a GIN index — mirroring the proven
 * `search_index.content_tsv` + `idx_search_index_tsv` pattern in `./search.ts`.
 * The SQLite mirror uses an FTS5 virtual table instead (see
 * `../schema-sqlite/admin-search.ts`); the index-maintenance + query dialect
 * dispatch follows the `isSqliteRuntime()` precedent
 * (`infrastructure/database/lookup/lookup-view-generators.ts`).
 *
 * ── Uniqueness / upsert. ───────────────────────────────────────────────────
 * `(type, entity_id)` is unique so a rebuild is an idempotent upsert: one row
 * per source entity, re-indexable in place.
 */

/**
 * Custom `tsvector` column type for PostgreSQL full-text search (local copy —
 * `./search.ts` keeps its own; admin-search must not import from it).
 */
const tsvector = (name: string) =>
  customType<{ data: string }>({
    dataType() {
      return 'tsvector'
    },
  })(name)

export const adminSearchIndex = systemSchema.table(
  '_admin_search_index',
  {
    id: serial('id').primaryKey(),
    /**
     * The entity-kind discriminator. One of: `record`, `submission`, `run`,
     * `user`, `file`, `conversation`, `connection`. Stored as TEXT (not a PG
     * enum) so adding a kind later needs no migration.
     */
    type: text('type').notNull(),
    entityId: text('entity_id').notNull(),
    /** Secret-free primary label (S4). */
    title: text('title').notNull(),
    /** Secret-free secondary searchable text. */
    body: text('body').notNull().default(''),
    /** Deep-link target the UI navigates to on selection. */
    href: text('href').notNull(),
    /**
     * Generated FTS document over `title || ' ' || body`. The GIN index on this
     * column powers the `@@` match (mirrors `search_index.content_tsv`).
     */
    contentTsv: tsvector('content_tsv')
      .notNull()
      .generatedAlwaysAs(
        sql`to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(body, ''))`
      ),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_admin_search_tsv').using('gin', table.contentTsv),
    index('idx_admin_search_type').on(table.type),
    unique('admin_search_type_entity_unique').on(table.type, table.entityId),
  ]
)

// Type inference
export type AdminSearchIndexRow = typeof adminSearchIndex.$inferSelect
export type NewAdminSearchIndexRow = typeof adminSearchIndex.$inferInsert
