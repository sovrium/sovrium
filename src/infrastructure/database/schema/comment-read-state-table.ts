/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { executeSQL, type SQLExecutionError, type TransactionLike } from '../sql/sql-execution'

const COMMENT_READ_STATE_TABLE_DDL_PG = `
CREATE TABLE IF NOT EXISTS "system"."comment_read_state" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "table_id" TEXT NOT NULL,
  "record_id" TEXT NOT NULL,
  "last_read_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
`.trim()

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
