/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { executeSQL, type SQLExecutionError, type TransactionLike } from '../sql/sql-execution'

/**
 * DDL for the multi-tenant `user_access` junction table (Z-2).
 *
 * Lives in `system.*` alongside the other engine-managed tables (see
 * `docs/architecture/patterns/internal-table-naming-convention.md`).
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

/**
 * Ensures the `user_access` junction table and supporting indexes exist
 * in the `system` schema.
 *
 * Idempotent across all states:
 * - Fresh install: `CREATE TABLE IF NOT EXISTS` creates `system.user_access`,
 *   `CREATE INDEX IF NOT EXISTS` creates the two indexes.
 * - Pre-relocation deployment: `ALTER TABLE … SET SCHEMA system` moves the
 *   existing `public.user_access` (data + indexes preserved); subsequent
 *   `CREATE TABLE / CREATE INDEX IF NOT EXISTS` are no-ops.
 * - Post-relocation: all three statements are no-ops.
 */
export const ensureUserAccessTable = (
  tx: TransactionLike
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    yield* executeSQL(tx, USER_ACCESS_RELOCATE_FROM_PUBLIC)
    yield* executeSQL(tx, USER_ACCESS_TABLE_DDL)
    yield* executeSQL(tx, USER_ACCESS_INDEX_USER)
    yield* executeSQL(tx, USER_ACCESS_INDEX_USER_TABLE)
  })
