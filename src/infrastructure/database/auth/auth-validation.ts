/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data } from 'effect'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { logDebug } from '@/infrastructure/logging/logger'
import { isUserReferenceField, isUserField } from '../sql/sql-generators'
import type { Table } from '@/domain/models/app/tables'

/**
 * Active SQL dialect for the validator helpers. Callers normally let the
 * default branch on {@link isSqliteRuntime}; tests pass an explicit value so
 * they don't depend on process env.
 */
type Dialect = 'sqlite' | 'postgres'

const defaultDialect = (): Dialect => (isSqliteRuntime() ? 'sqlite' : 'postgres')

export class BetterAuthUsersTableRequired extends Data.TaggedError('BetterAuthUsersTableRequired')<{
  readonly message: string
}> {}

/**
 * Check if any table needs the users table for foreign keys
 */
export const needsUsersTable = (tables: readonly Table[]): boolean =>
  tables.some((table) =>
    table.fields.some((field) => isUserReferenceField(field) || isUserField(field))
  )

/**
 * Check if any table has updated-by fields that need the trigger function
 */
export const needsUpdatedByTrigger = (tables: readonly Table[]): boolean =>
  tables.some((table) => table.fields.some((field) => field.type === 'updated-by'))

/**
 * Verify Better Auth users table exists for foreign key references.
 *
 * User fields (user, created-by, updated-by, deleted-by) require Better Auth's
 * users table. Better Auth uses TEXT ids on both dialects, so user fields store
 * TEXT foreign keys.
 *
 * Catalog queries are dialect-specific:
 *   - PostgreSQL: `information_schema.tables` / `information_schema.columns`
 *     against the `auth` schema (where `pgSchema('auth')` puts the table).
 *   - SQLite: `sqlite_master` + `pragma_table_info('auth_user')`. SQLite has
 *     no schemas, so the Better Auth `auth.user` table is laid out flat as
 *     `auth_user` (see `auth.ts` `drizzleSchemaSqlite`).
 *
 * @throws BetterAuthUsersTableRequired if users table doesn't exist or lacks required columns
 */
/* eslint-disable functional/no-throw-statements */
export const ensureBetterAuthUsersTable = async (
  tx: { unsafe: (sql: string) => Promise<unknown> },
  dialect: Dialect = defaultDialect()
): Promise<void> => {
  logDebug('[ensureBetterAuthUsersTable] Verifying Better Auth users table exists...')

  // -- Existence check (per-dialect catalog) -------------------------------
  const tableExistsResult =
    dialect === 'sqlite'
      ? ((await tx.unsafe(`
          SELECT EXISTS (
            SELECT 1 FROM sqlite_master
            WHERE type = 'table' AND name = 'auth_user'
          ) as "exists"
        `)) as readonly { exists: number | boolean }[])
      : ((await tx.unsafe(`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'auth' AND table_name = 'user'
          ) as exists
        `)) as readonly { exists: boolean }[])

  // bun:sqlite returns the EXISTS column as `0`/`1` while pg returns `boolean`;
  // the unary `!` coerces both to the same falsy semantics.
  if (!tableExistsResult[0]?.exists) {
    throw new BetterAuthUsersTableRequired({
      message:
        'User fields require Better Auth users table. Please configure Better Auth authentication before using user, created-by, updated-by, or deleted-by field types.',
    })
  }

  // -- id column type check (per-dialect catalog) --------------------------
  const idType =
    dialect === 'sqlite' ? await readSqliteAuthUserIdType(tx) : await readPostgresAuthUserIdType(tx)

  if (idType === undefined) {
    throw new BetterAuthUsersTableRequired({
      message:
        'Users table exists but lacks id column. Please ensure Better Auth is properly configured.',
    })
  }

  const acceptableIdTypes =
    dialect === 'sqlite' ? new Set(['text']) : new Set(['text', 'character varying'])

  if (!acceptableIdTypes.has(idType)) {
    throw new BetterAuthUsersTableRequired({
      message: `Users table has incompatible id column type '${idType}'. Better Auth uses TEXT ids. Please configure Better Auth authentication.`,
    })
  }

  logDebug('[ensureBetterAuthUsersTable] Better Auth users table verified successfully')
}
/* eslint-enable functional/no-throw-statements */

/**
 * Read the `id` column type from the SQLite `auth_user` table via
 * `pragma_table_info` — the SQLite analogue of PG's `information_schema.columns`.
 * Returns the lower-cased declared type (e.g. `'text'`) or `undefined` when the
 * column does not exist.
 */
const readSqliteAuthUserIdType = async (tx: {
  unsafe: (sql: string) => Promise<unknown>
}): Promise<string | undefined> => {
  const result = (await tx.unsafe(`
    SELECT type FROM pragma_table_info('auth_user') WHERE name = 'id'
  `)) as readonly { type: string }[]
  return result[0]?.type.toLowerCase()
}

/**
 * Read the `id` column type from the PostgreSQL `auth.user` table via
 * `information_schema.columns`. Returns the lower-cased `data_type` or
 * `undefined` when the column does not exist.
 */
const readPostgresAuthUserIdType = async (tx: {
  unsafe: (sql: string) => Promise<unknown>
}): Promise<string | undefined> => {
  const result = (await tx.unsafe(`
    SELECT data_type FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'user' AND column_name = 'id'
  `)) as readonly { data_type: string }[]
  return result[0]?.data_type.toLowerCase()
}

/**
 * Ensure global `set_updated_by` trigger function exists.
 *
 * On PostgreSQL this declares a no-op `LANGUAGE plpgsql` function that paired
 * `BEFORE UPDATE` triggers reference (see `generators/trigger-generators.ts`).
 *
 * On SQLite this is a no-op early-return: SQLite has no `plpgsql` and
 * `generateUpdatedByTriggers` already skips trigger emission on SQLite
 * (`trigger-generators.ts:127`), so there's nothing for this function to set
 * up. Running the PG `CREATE OR REPLACE FUNCTION` body on SQLite would crash
 * with a syntax error.
 */
/* eslint-disable functional/no-expression-statements */
export const ensureUpdatedByTriggerFunction = async (
  tx: { unsafe: (sql: string) => Promise<unknown> },
  dialect: Dialect = defaultDialect()
): Promise<void> => {
  if (dialect === 'sqlite') return
  await tx.unsafe(`
    CREATE OR REPLACE FUNCTION set_updated_by()
    RETURNS TRIGGER AS $$
    BEGIN
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `)
}
/* eslint-enable functional/no-expression-statements */
