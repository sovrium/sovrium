/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Pre-flight check for the `account.issuer` migration.
 *
 * That migration adds a UNIQUE index on `(issuer, account_id)`. The backfill
 * maps `provider_id` to an issuer injectively — `credential` becomes
 * `local:credential`, and each social provider becomes a distinct
 * `local:oauth:<id>` — so `(issuer, account_id)` collides after the backfill
 * if and only if `(provider_id, account_id)` already collided before it. The
 * detection query below is therefore exact, not a heuristic.
 *
 * Without this check the operator sees a bare `UNIQUE constraint failed` and
 * has nothing to act on. With it they get the offending rows by name.
 *
 * Deliberately detect-and-refuse rather than de-duplicate. Removing one of two
 * colliding rows is destructive and plausible-looking: for two social rows
 * belonging to different people it silently severs one person's login, and for
 * two password rows it may delete the live password and keep a stale one.
 * Deleting authentication rows to make a migration pass is exactly the
 * "successful migration over corrupted data" outcome this guards against. The
 * operator decides which row survives.
 *
 * The check costs nothing once the column exists, and nothing on a fresh
 * install where the table has yet to be created.
 */

/** One offending `(provider_id, account_id)` group. */
export interface AccountCollisionRow {
  readonly providerId: string
  readonly accountId: string
  readonly count: number
}

/** Upstream's own write-up of the identity change. */
export const ACCOUNT_ISSUER_GUIDE_URL =
  'https://better-auth.com/docs/guides/1-7-upgrade-guide#account-identity-is-scoped-by-issuer'

/** How many offending groups to name before summarising the remainder. */
const MAX_LISTED = 20

/**
 * Build the operator-facing refusal message.
 *
 * Pure, so the wording is unit-testable without a database.
 */
export const formatAccountCollisionMessage = (rows: readonly AccountCollisionRow[]): string => {
  const listed = rows
    .slice(0, MAX_LISTED)
    .map((r) => `  - provider_id=${r.providerId} account_id=${r.accountId} (${r.count} rows)`)
    .join('\n')
  const remainder =
    rows.length > MAX_LISTED ? `\n  … and ${rows.length - MAX_LISTED} more group(s)` : ''
  return [
    `Cannot upgrade: the account table holds ${rows.length} duplicate identity group(s).`,
    '',
    'This release identifies an account by (issuer, account_id) and adds a UNIQUE',
    'index enforcing it. These rows would violate that index:',
    '',
    `${listed}${remainder}`,
    '',
    'Nothing has been changed. Decide which row in each group is the real one and',
    'remove the others, then start again. Sovrium will not choose for you: deleting',
    'the wrong row silently destroys a working login or a live password.',
    '',
    `Background: ${ACCOUNT_ISSUER_GUIDE_URL}`,
  ].join('\n')
}

/**
 * Normalise a driver row into {@link AccountCollisionRow}.
 *
 * Both drivers return loosely-typed records; counts come back as a number on
 * SQLite and can arrive as a string from Postgres. `Number()` is load-bearing
 * rather than defensive: it is also what keeps this correct if a driver hands
 * back a BigInt instead, as drizzle-orm 1.0.0-rc.4 did until the migration
 * client stopped forcing that option on.
 */
const toCollisionRow = (row: Readonly<Record<string, unknown>>): AccountCollisionRow => ({
  providerId: String(row['provider_id'] ?? ''),
  accountId: String(row['account_id'] ?? ''),
  count: Number(row['n'] ?? 0),
})

/**
 * Find duplicate identity groups in a PostgreSQL `auth.account` table.
 *
 * Returns an empty list when the table is absent (fresh install) or the
 * `issuer` column already exists (already upgraded).
 */
export const detectPostgresAccountCollisions = async (
  query: (sql: string) => Promise<unknown>
): Promise<readonly AccountCollisionRow[]> => {
  const state = (await query(
    `SELECT
       to_regclass('auth.account') IS NOT NULL AS table_exists,
       EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'auth' AND table_name = 'account' AND column_name = 'issuer'
       ) AS column_exists`
  )) as readonly Record<string, unknown>[]
  const row = state[0]
  if (row?.['table_exists'] !== true || row['column_exists'] === true) return []

  const rows = (await query(
    `SELECT provider_id, account_id, COUNT(*) AS n
     FROM "auth"."account"
     GROUP BY provider_id, account_id
     HAVING COUNT(*) > 1
     ORDER BY n DESC, provider_id, account_id`
  )) as readonly Record<string, unknown>[]
  return rows.map(toCollisionRow)
}

/**
 * Find duplicate identity groups in a SQLite `auth_account` table.
 *
 * Same short-circuits as the Postgres variant. `bun:sqlite` is synchronous, so
 * this takes a plain query callback rather than a promise-returning one.
 */
export const detectSqliteAccountCollisions = (
  query: (sql: string) => readonly unknown[]
): readonly AccountCollisionRow[] => {
  const table = query(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'auth_account'`
  )
  if (table.length === 0) return []

  const columns = query(`PRAGMA table_info(auth_account)`) as readonly Record<string, unknown>[]
  if (columns.some((c) => c['name'] === 'issuer')) return []

  const rows = query(
    `SELECT provider_id, account_id, COUNT(*) AS n
     FROM auth_account
     GROUP BY provider_id, account_id
     HAVING COUNT(*) > 1
     ORDER BY n DESC, provider_id, account_id`
  ) as readonly Record<string, unknown>[]
  return rows.map(toCollisionRow)
}
