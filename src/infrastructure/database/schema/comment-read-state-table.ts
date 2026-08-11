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
 * DDL for the engine-managed `system.comment_read_state` table ([internal ref],
 * opt-in `comments.readTracking`).
 *
 * Stores a per-user high-watermark: one row per `(user_id, table_id,
 * record_id)`, where `last_read_at` is the moment the user last marked that
 * record's comments read. The comment read response counts comments newer than
 * this watermark (or all comments when no row exists) to derive `unreadCount`.
 *
 * Created at runtime by `schema-initializer.ts` ONLY when some table opts into
 * `comments.readTracking` — not shipped unconditionally with the engine, and
 * not in the Drizzle migration barrel (so it produces no migration DDL). Lives
 * in `system.*` alongside the other engine-managed tables (see
 * `[internal ref]`).
 *
 * Shape:
 *
 * | Column        | Type        | Notes                                       |
 * |---------------|-------------|---------------------------------------------|
 * | id            | TEXT        | Primary key (application-supplied UUID)      |
 * | user_id       | TEXT        | Better Auth user id (in spirit auth.user.id) |
 * | table_id      | TEXT        | Mirrors record_comments.table_id            |
 * | record_id     | TEXT        | Mirrors record_comments.record_id           |
 * | last_read_at  | TIMESTAMPTZ | High-watermark; upserted to NOW() on read   |
 *
 * A unique index on `(user_id, table_id, record_id)` backs the mark-read
 * upsert's `ON CONFLICT` target.
 */
const COMMENT_READ_STATE_TABLE_DDL_PG = `
CREATE TABLE IF NOT EXISTS "system"."comment_read_state" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "table_id" TEXT NOT NULL,
  "record_id" TEXT NOT NULL,
  "last_read_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
`.trim()

/**
 * SQLite mirror of the comment-read-state DDL. PG-isms translated as follows:
 *   - `system.comment_read_state` → bare `system_comment_read_state`
 *     (SQLite has no schemas; matches the `systemTable()` prefix helper).
 *   - `TEXT PRIMARY KEY DEFAULT` — id is application-populated (crypto.randomUUID).
 *   - `TIMESTAMPTZ NOT NULL DEFAULT NOW()` → `INTEGER NOT NULL DEFAULT (…)`
 *     epoch-ms via strftime — matches the SQLite `timestamp_ms` column mode and
 *     `record_comments.created_at`, so `created_at > last_read_at` compares in
 *     the same units.
 */
const COMMENT_READ_STATE_TABLE_DDL_SQLITE = `
CREATE TABLE IF NOT EXISTS system_comment_read_state (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  table_id TEXT NOT NULL,
  record_id TEXT NOT NULL,
  last_read_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000)
)
`.trim()

const COMMENT_READ_STATE_UNIQUE_INDEX_PG = `
CREATE UNIQUE INDEX IF NOT EXISTS "idx_comment_read_state_user_table_record"
  ON "system"."comment_read_state" ("user_id", "table_id", "record_id")
`.trim()

const COMMENT_READ_STATE_UNIQUE_INDEX_SQLITE = `
CREATE UNIQUE INDEX IF NOT EXISTS idx_comment_read_state_user_table_record
  ON system_comment_read_state (user_id, table_id, record_id)
`.trim()

/**
 * Ensure the `comment_read_state` table and its supporting unique index exist.
 *
 * Idempotent — `CREATE TABLE / CREATE UNIQUE INDEX IF NOT EXISTS` are no-ops on
 * subsequent boots. Created only when a table opts into
 * `comments.readTracking` (gated by the caller in `schema-initializer.ts`).
 *
 * Dialect-aware: SQLite branch uses a flat-name table, a TEXT primary key
 * (application-populated), and INTEGER epoch-ms instead of TIMESTAMPTZ.
 */
export const ensureCommentReadStateTable = (
  tx: TransactionLike
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    if (isSqliteRuntime()) {
      yield* executeSQL(tx, COMMENT_READ_STATE_TABLE_DDL_SQLITE)
      yield* executeSQL(tx, COMMENT_READ_STATE_UNIQUE_INDEX_SQLITE)
      return
    }
    yield* executeSQL(tx, COMMENT_READ_STATE_TABLE_DDL_PG)
    yield* executeSQL(tx, COMMENT_READ_STATE_UNIQUE_INDEX_PG)
  })
