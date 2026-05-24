/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { executeSQL, type SQLExecutionError, type TransactionLike } from '../sql/sql-execution'


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

export const ensureUserAccessTable = (
  tx: TransactionLike
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    if (isSqliteRuntime()) {
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
