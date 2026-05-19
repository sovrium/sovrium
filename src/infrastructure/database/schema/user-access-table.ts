/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { executeSQL, type SQLExecutionError, type TransactionLike } from '../sql/sql-execution'


const USER_ACCESS_RELOCATE_FROM_PUBLIC = `
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

const USER_ACCESS_TABLE_DDL = `
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

const USER_ACCESS_INDEX_USER = `
CREATE INDEX IF NOT EXISTS "idx_user_access_user_id" ON "system"."user_access" ("user_id")
`.trim()

const USER_ACCESS_INDEX_USER_TABLE = `
CREATE INDEX IF NOT EXISTS "idx_user_access_user_table" ON "system"."user_access" ("user_id", "table_slug")
`.trim()

export const ensureUserAccessTable = (
  tx: TransactionLike
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    yield* executeSQL(tx, USER_ACCESS_RELOCATE_FROM_PUBLIC)
    yield* executeSQL(tx, USER_ACCESS_TABLE_DDL)
    yield* executeSQL(tx, USER_ACCESS_INDEX_USER)
    yield* executeSQL(tx, USER_ACCESS_INDEX_USER_TABLE)
  })
