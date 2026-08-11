/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { executeSQL, type SQLExecutionError, type TransactionLike } from '../sql/sql-execution'

/**
 * DDL for the multi-tenant `user_access` junction table (Z-2).
 *
 * Lives in `system.*` alongside the other engine-managed tables (see
 * `[internal ref]`).
 * Created at runtime by `schema-initializer.ts` when `auth.scopeTables`
 * is configured — not shipped unconditionally with the engine.
 *
 * Shape (intentionally generic so it can host scope grants for any table
 * referenced by `auth.scopeTables`):
 *
 * | Column      | Type   | Notes                                          |
 * |-------------|--------|------------------------------------------------|
 * | id          | UUID   | Primary key, default gen_random_uuid()         |
 * | user_id     | TEXT   | FK in spirit to auth.user.id (Better Auth IDs) |
 * | table_slug  | TEXT   | Validated against `auth.scopeTables` at insert |
 * | record_ids  | TEXT[] | Non-empty list of record-id strings/UUIDs      |
 * | role        | TEXT   | App-defined role from `auth.roles`             |
 * | created_at  | TIMESTAMPTZ | Audit                                     |
 * | created_by  | TEXT   | Audit                                          |
 *
 * Z-1 ($currentUser.assignments.<table>) reads this table at request time
 * and flattens `record_ids` across all rows for the active user matching
 * `table_slug`.
 *
 * Note: This DDL uses TEXT (not UUID) for `user_id` and `record_ids` so
 * Better Auth's nanoid-style IDs and arbitrary string keys (e.g. 'c1') used
 * by tests / small applications work without forcing a UUID format.
 */

/**
 * Idempotent migration step that relocates a pre-existing
 * `public.user_access` table to `system.user_access`. No-op when the table
 * is absent (fresh install) or already in `system` (post-migration). Data,
 * indexes, and constraints follow the table on `ALTER TABLE … SET SCHEMA`.
 */
const USER_ACCESS_RELOCATE_FROM_PUBLIC_PG = `
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_access'
  ) THEN
    EXECUTE 'ALTER TABLE public.user_access SET SCHEMA system';
  END IF;
END $$;
`.trim()

const USER_ACCESS_TABLE_DDL_PG = `
CREATE TABLE IF NOT EXISTS "system"."user_access" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" TEXT NOT NULL,
  "table_slug" TEXT NOT NULL,
  "record_ids" TEXT[] NOT NULL,
  "role" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "created_by" TEXT
)
`.trim()

/**
 * SQLite mirror of the user_access DDL. Three engine-specific translations:
 *
 *   - Schema prefix → flat name. SQLite has no schemas; `"system"."user_access"`
 *     is invalid. The SQLite mirror uses `system_user_access` (matches the
 *     `systemTable()` helper used elsewhere for the `system` namespace).
 *   - `UUID PRIMARY KEY DEFAULT gen_random_uuid()` → `TEXT PRIMARY KEY`. SQLite
 *     has no UUID type and no `gen_random_uuid()`. IDs are TEXT primary keys
 *     populated by the application layer (Better Auth + repositories use
 *     `crypto.randomUUID()` from JS land — matches the SQLite mirror schemas
 *     for the other `system_*` tables).
 *   - `TEXT[]` → `TEXT`. SQLite has no array type. The column stores a JSON
 *     array as TEXT. The application reads it via Drizzle's `text(mode:'json')`
 *     mode in the SQLite mirror schema (`schema-sqlite/user-access.ts`).
 *   - `TIMESTAMPTZ NOT NULL DEFAULT NOW()` → `INTEGER NOT NULL` with a default
 *     epoch-ms value via `strftime`. The SQLite mirror stores `created_at` as
 *     `integer('created_at', { mode: 'timestamp_ms' })`.
 *
 * The PG `public → system` schema relocation is skipped entirely on SQLite —
 * the concept does not apply (no schemas to relocate between).
 */
const USER_ACCESS_TABLE_DDL_SQLITE = `
CREATE TABLE IF NOT EXISTS system_user_access (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  table_slug TEXT NOT NULL,
  record_ids TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000),
  created_by TEXT
)
`.trim()

const USER_ACCESS_INDEX_USER_PG = `
CREATE INDEX IF NOT EXISTS "idx_user_access_user_id" ON "system"."user_access" ("user_id")
`.trim()

const USER_ACCESS_INDEX_USER_TABLE_PG = `
CREATE INDEX IF NOT EXISTS "idx_user_access_user_table" ON "system"."user_access" ("user_id", "table_slug")
`.trim()

const USER_ACCESS_INDEX_USER_SQLITE = `
CREATE INDEX IF NOT EXISTS idx_user_access_user_id ON system_user_access (user_id)
`.trim()

const USER_ACCESS_INDEX_USER_TABLE_SQLITE = `
CREATE INDEX IF NOT EXISTS idx_user_access_user_table ON system_user_access (user_id, table_slug)
`.trim()

/**
 * Ensures the `user_access` junction table and supporting indexes exist
 * in the `system` schema (PostgreSQL) or as `system_user_access` (SQLite).
 *
 * Idempotent across all states:
 * - Fresh install: `CREATE TABLE IF NOT EXISTS` creates the table,
 *   `CREATE INDEX IF NOT EXISTS` creates the two indexes.
 * - Pre-relocation PG deployment: `ALTER TABLE … SET SCHEMA system` moves the
 *   existing `public.user_access` (data + indexes preserved); subsequent
 *   `CREATE TABLE / CREATE INDEX IF NOT EXISTS` are no-ops.
 * - Post-relocation: all statements are no-ops.
 *
 * Dialect-aware: SQLite has no schemas, no `UUID`/`TEXT[]`/`TIMESTAMPTZ`, no
 * `DO $$ … $$;` PL/pgSQL blocks, no `gen_random_uuid()`. The SQLite branch
 * uses a flat-prefix table name, TEXT primary key (application-populated),
 * TEXT JSON for the array, and INTEGER epoch-ms for the timestamp.
 */
export const ensureUserAccessTable = (
  tx: TransactionLike
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    if (isSqliteRuntime()) {
      // No `public → system` relocation on SQLite (no schemas).
      yield* executeSQL(tx, USER_ACCESS_TABLE_DDL_SQLITE)
      yield* executeSQL(tx, USER_ACCESS_INDEX_USER_SQLITE)
      yield* executeSQL(tx, USER_ACCESS_INDEX_USER_TABLE_SQLITE)
      return
    }
    yield* executeSQL(tx, USER_ACCESS_RELOCATE_FROM_PUBLIC_PG)
    yield* executeSQL(tx, USER_ACCESS_TABLE_DDL_PG)
    yield* executeSQL(tx, USER_ACCESS_INDEX_USER_PG)
    yield* executeSQL(tx, USER_ACCESS_INDEX_USER_TABLE_PG)
  })
