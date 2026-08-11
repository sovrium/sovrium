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
 * DDL for the engine-managed `_webhook_deliveries` delivery log.
 *
 * Records every outgoing table-webhook delivery attempt — fired when a
 * record is created, updated, or deleted in a table that declares
 * `tables[].webhooks`. The table lives in the `public` schema (leading
 * underscore marks it engine-managed) so spec authors can query it directly
 * via `executeQuery('SELECT ... FROM _webhook_deliveries')` without a schema
 * qualifier.
 *
 * Shape (intentionally generic so retry/payload/auth specs share it):
 *
 * | Column          | Type        | Notes                                       |
 * |-----------------|-------------|---------------------------------------------|
 * | id              | SERIAL      | Primary key (stable insert order)           |
 * | webhook_name    | TEXT        | The `tables[].webhooks[].name` that fired   |
 * | table_name      | TEXT        | Owning table name                           |
 * | event           | TEXT        | `record.create` / `record.update` / ...     |
 * | url             | TEXT        | Destination URL                             |
 * | payload         | JSONB       | The delivered request body                  |
 * | request_headers | JSONB       | Headers sent with the request               |
 * | status          | TEXT        | `success` / `failed`                        |
 * | http_status     | INTEGER     | Response status code (NULL on transport err)|
 * | attempt_count   | INTEGER     | Number of delivery attempts (>= 1)          |
 * | retry_strategy  | TEXT        | Retry backoff strategy (NULL when no retry) |
 * | error           | TEXT        | Failure reason (NULL on success)            |
 * | response_body   | TEXT        | Response body (NULL when none captured)     |
 * | duration_ms     | INTEGER     | Round-trip duration in milliseconds         |
 * | is_test         | BOOLEAN     | True for test-mode deliveries               |
 * | requested_at    | TIMESTAMPTZ | When the delivery attempt started           |
 * | completed_at    | TIMESTAMPTZ | When the delivery attempt finished          |
 * | created_at      | TIMESTAMPTZ | Audit                                       |
 */
const WEBHOOK_DELIVERIES_TABLE_DDL_PG = `
CREATE TABLE IF NOT EXISTS "public"."_webhook_deliveries" (
  "id" SERIAL PRIMARY KEY,
  "webhook_name" TEXT NOT NULL,
  "table_name" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "request_headers" JSONB,
  "status" TEXT NOT NULL,
  "http_status" INTEGER,
  "attempt_count" INTEGER NOT NULL DEFAULT 1,
  "retry_strategy" TEXT,
  "error" TEXT,
  "response_body" TEXT,
  "duration_ms" INTEGER NOT NULL DEFAULT 0,
  "is_test" BOOLEAN NOT NULL DEFAULT FALSE,
  "requested_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "completed_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
`.trim()

/**
 * SQLite mirror of the webhook-deliveries DDL. PG-isms translated as follows:
 *   - `public._webhook_deliveries` → bare `_webhook_deliveries` (no schemas)
 *   - `SERIAL PRIMARY KEY` → `INTEGER PRIMARY KEY AUTOINCREMENT`
 *     (SQLite's rowid alias; auto-increments the ROWID)
 *   - `JSONB` → `TEXT` (SQLite has no JSONB; stored as JSON text via Drizzle
 *     `text(mode:'json')` in the mirror schema)
 *   - `TIMESTAMPTZ NOT NULL DEFAULT NOW()` → `INTEGER NOT NULL DEFAULT (...)`
 *     epoch-ms via strftime — matches the SQLite `timestamp_ms` mode
 *   - `BOOLEAN NOT NULL DEFAULT FALSE` → `INTEGER NOT NULL DEFAULT 0`
 *     (SQLite has no native boolean; stored as 0/1 INTEGER)
 */
const WEBHOOK_DELIVERIES_TABLE_DDL_SQLITE = `
CREATE TABLE IF NOT EXISTS _webhook_deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  webhook_name TEXT NOT NULL,
  table_name TEXT NOT NULL,
  event TEXT NOT NULL,
  url TEXT NOT NULL,
  payload TEXT NOT NULL,
  request_headers TEXT,
  status TEXT NOT NULL,
  http_status INTEGER,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  retry_strategy TEXT,
  error TEXT,
  response_body TEXT,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  is_test INTEGER NOT NULL DEFAULT 0,
  requested_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000),
  completed_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000),
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000)
)
`.trim()

const WEBHOOK_DELIVERIES_INDEX_NAME_PG = `
CREATE INDEX IF NOT EXISTS "idx_webhook_deliveries_webhook_name"
  ON "public"."_webhook_deliveries" ("webhook_name")
`.trim()

const WEBHOOK_DELIVERIES_INDEX_NAME_SQLITE = `
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_name
  ON _webhook_deliveries (webhook_name)
`.trim()

/**
 * Ensure the `_webhook_deliveries` delivery-log table exists.
 *
 * Idempotent — `CREATE TABLE / CREATE INDEX IF NOT EXISTS` are no-ops on
 * subsequent boots. Created unconditionally (when ANY table declares
 * webhooks) so the table is queryable even before the first webhook fires
 * (delivery-count assertions expect 0, not a missing-relation error).
 *
 * Dialect-aware: SQLite branch uses flat-name table, INTEGER PK with
 * AUTOINCREMENT, TEXT (JSON) instead of JSONB, INTEGER epoch-ms instead of
 * TIMESTAMPTZ, INTEGER 0/1 instead of BOOLEAN.
 */
export const ensureWebhookDeliveriesTable = (
  tx: TransactionLike
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    if (isSqliteRuntime()) {
      yield* executeSQL(tx, WEBHOOK_DELIVERIES_TABLE_DDL_SQLITE)
      yield* executeSQL(tx, WEBHOOK_DELIVERIES_INDEX_NAME_SQLITE)
      return
    }
    yield* executeSQL(tx, WEBHOOK_DELIVERIES_TABLE_DDL_PG)
    yield* executeSQL(tx, WEBHOOK_DELIVERIES_INDEX_NAME_PG)
  })
