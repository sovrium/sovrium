/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Admin Global Search FTS5 boot DDL (SQLite ONLY) — [internal ref].
 *
 * The Drizzle SQLite migration creates the durable CONTENT table
 * `system__admin_search_index` (id / type / entity_id / title / body / href /
 * updated_at). Drizzle's sqlite-core has no first-class virtual-table builder, so
 * the FTS5 search index — the virtual table `system__admin_search_fts` plus the
 * INSERT / UPDATE / DELETE sync triggers that keep it in lock-step with the
 * content table — is created here via RAW DDL at boot.
 *
 * This follows the established DDL-dispatch precedent in
 * `lookup/lookup-view-generators.ts` (which emits inline `CREATE TRIGGER …
 * INSTEAD OF …` on the SQLite branch). Every statement is `IF NOT EXISTS` /
 * idempotent so re-running boot is harmless.
 *
 * The FTS5 table uses `content='system__admin_search_index'` +
 * `content_rowid='id'` — the EXTERNAL-CONTENT pattern: the vtab stores only the
 * inverted index over `title` / `body`, the durable rows live in the content
 * table, and the triggers below mirror every content-table write into the FTS5
 * index. The admin-search repo-live's SELECT joins the content table to
 * `…_fts WHERE …_fts MATCH ?`.
 *
 * On PostgreSQL this module is irrelevant: the generated `content_tsv` column +
 * GIN index live ON the table itself (from the PG migration), so there is no
 * boot DDL.
 */

/**
 * The physical content-table name (the `system_` prefix + the `_admin_search_index`
 * logical name produced by `sqliteTableCreator`). MUST match the Drizzle SQLite
 * mirror in `drizzle/schema-sqlite/admin-search.ts`.
 */
export const ADMIN_SEARCH_CONTENT_TABLE = 'system__admin_search_index'

/** The FTS5 virtual-table name the admin-search SELECT runs `MATCH` against. */
export const ADMIN_SEARCH_FTS_TABLE = 'system__admin_search_fts'

/**
 * The idempotent boot DDL statements that create the FTS5 virtual table + its
 * three content-sync triggers. Returned as a list so the caller can run them in
 * order inside its open `bun:sqlite` client.
 *
 * The trigger bodies mirror the canonical external-content FTS5 sync pattern:
 *   - AFTER INSERT  → insert the new row's title/body into the index.
 *   - AFTER DELETE  → emit the special `'delete'` command row so FTS5 removes it.
 *   - AFTER UPDATE  → delete-then-insert (the index has no in-place update).
 */
export const adminSearchFtsBootStatements = (): readonly string[] => [
  `CREATE VIRTUAL TABLE IF NOT EXISTS ${ADMIN_SEARCH_FTS_TABLE} USING fts5(
     title,
     body,
     content='${ADMIN_SEARCH_CONTENT_TABLE}',
     content_rowid='id'
   )`,
  `CREATE TRIGGER IF NOT EXISTS ${ADMIN_SEARCH_CONTENT_TABLE}_ai
     AFTER INSERT ON ${ADMIN_SEARCH_CONTENT_TABLE} BEGIN
       INSERT INTO ${ADMIN_SEARCH_FTS_TABLE}(rowid, title, body)
       VALUES (new.id, new.title, new.body);
     END`,
  `CREATE TRIGGER IF NOT EXISTS ${ADMIN_SEARCH_CONTENT_TABLE}_ad
     AFTER DELETE ON ${ADMIN_SEARCH_CONTENT_TABLE} BEGIN
       INSERT INTO ${ADMIN_SEARCH_FTS_TABLE}(${ADMIN_SEARCH_FTS_TABLE}, rowid, title, body)
       VALUES ('delete', old.id, old.title, old.body);
     END`,
  `CREATE TRIGGER IF NOT EXISTS ${ADMIN_SEARCH_CONTENT_TABLE}_au
     AFTER UPDATE ON ${ADMIN_SEARCH_CONTENT_TABLE} BEGIN
       INSERT INTO ${ADMIN_SEARCH_FTS_TABLE}(${ADMIN_SEARCH_FTS_TABLE}, rowid, title, body)
       VALUES ('delete', old.id, old.title, old.body);
       INSERT INTO ${ADMIN_SEARCH_FTS_TABLE}(rowid, title, body)
       VALUES (new.id, new.title, new.body);
     END`,
]
