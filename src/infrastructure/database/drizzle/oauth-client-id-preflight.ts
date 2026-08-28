/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Pre-flight check for the `oauth_client.client_id` UNIQUE constraint.
 *
 * `oauth_client` has shipped since v0.11.0 WITHOUT that constraint, while the
 * OAuth-provider plugin has always assumed it: upstream declares the column
 * `unique: true` and enforces uniqueness THROUGH the database — dynamic client
 * registration does no pre-flight lookup, it inserts and catches the constraint
 * violation to raise `oauth-client-row-unique`. On a Sovrium instance that
 * detection never fired, because the constraint was not there to be violated.
 *
 * So duplicate `client_id` values are reachable on live operator data. The
 * random fallback id is 32 characters drawn from `a-zA-Z`, whose collision
 * probability is negligible; the real vector is a caller-SUPPLIED id, which
 * registration takes verbatim (`input.clientId ?? …`). Two registrations naming
 * the same `client_id` both succeeded, and the second silently shadowed the
 * first for every lookup that expects one row.
 *
 * The migration that adds the constraint therefore CAN fail mid-upgrade, with a
 * bare `duplicate key value violates unique constraint` and no indication of
 * which rows are at fault. This names them.
 *
 * Deliberately detect-and-refuse rather than de-duplicate — the same stance as
 * the account-identity probe, for the same reason. Dropping one of two clients
 * sharing an id is destructive and plausible-looking: it revokes a live
 * integration's credentials and cascades into that client's tokens, consents and
 * resource links. Deleting authentication rows to make a migration pass is
 * exactly the "successful migration over corrupted data" outcome this guards
 * against. The operator decides which client survives.
 *
 * The check costs nothing once the constraint exists, and nothing on a fresh
 * install where the table has yet to be created.
 */

/** One offending `client_id`, and how many rows claim it. */
export interface OauthClientIdCollisionRow {
  readonly clientId: string
  readonly count: number
}

/** How many offending ids to name before summarising the remainder. */
const MAX_LISTED = 20

/**
 * Build the operator-facing refusal message.
 *
 * Pure, so the wording is unit-testable without a database.
 */
export const formatOauthClientIdCollisionMessage = (
  rows: readonly OauthClientIdCollisionRow[]
): string => {
  const listed = rows
    .slice(0, MAX_LISTED)
    .map((r) => `  - client_id=${r.clientId} (${r.count} rows)`)
    .join('\n')
  const remainder =
    rows.length > MAX_LISTED ? `\n  … and ${rows.length - MAX_LISTED} more id(s)` : ''
  return [
    `Cannot upgrade: the OAuth client table holds ${rows.length} duplicate client id(s).`,
    '',
    'An OAuth client is identified by its client_id, and this release adds the',
    'UNIQUE constraint enforcing that — the constraint the OAuth-provider plugin',
    'has always assumed. These rows would violate it:',
    '',
    `${listed}${remainder}`,
    '',
    'Nothing has been changed. Decide which row for each id is the real client and',
    'remove the others, then start again. Sovrium will not choose for you: removing',
    'the wrong row revokes a live integration and cascades into its tokens, consents',
    'and resource links.',
  ].join('\n')
}

/**
 * Normalise a driver row into {@link OauthClientIdCollisionRow}.
 *
 * Counts come back as a number on SQLite and as a string from Postgres, which
 * returns `COUNT(*)` as a bigint.
 */
const toCollisionRow = (row: Readonly<Record<string, unknown>>): OauthClientIdCollisionRow => ({
  clientId: String(row['client_id'] ?? ''),
  count: Number(row['n'] ?? 0),
})

/**
 * Find duplicate `client_id` values in a PostgreSQL `auth.oauth_client` table.
 *
 * Returns an empty list when the table is absent (fresh install) or a unique
 * index already covers `client_id` alone (already upgraded).
 */
export const detectPostgresOauthClientIdCollisions = async (
  query: (sql: string) => Promise<unknown>
): Promise<readonly OauthClientIdCollisionRow[]> => {
  const state = (await query(
    `SELECT
       to_regclass('auth.oauth_client') IS NOT NULL AS table_exists,
       EXISTS (
         SELECT 1
         FROM pg_index i
         JOIN pg_class c ON c.oid = i.indrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = i.indkey[0]
         WHERE n.nspname = 'auth'
           AND c.relname = 'oauth_client'
           AND i.indisunique
           AND i.indnkeyatts = 1
           AND a.attname = 'client_id'
       ) AS unique_exists`
  )) as readonly Record<string, unknown>[]
  const row = state[0]
  if (row?.['table_exists'] !== true || row['unique_exists'] === true) return []

  const rows = (await query(
    `SELECT client_id, COUNT(*) AS n
     FROM "auth"."oauth_client"
     GROUP BY client_id
     HAVING COUNT(*) > 1
     ORDER BY n DESC, client_id`
  )) as readonly Record<string, unknown>[]
  return rows.map(toCollisionRow)
}

/**
 * Find duplicate `client_id` values in a SQLite `auth_oauth_client` table.
 *
 * Same short-circuits as the Postgres variant. The unique-index probe uses the
 * table-valued `pragma_index_list` / `pragma_index_info` functions and matches
 * only a single-column unique index over `client_id`, so neither the plain
 * `oauthClient_clientId_idx` index nor the implicit primary-key autoindex over
 * `id` is mistaken for the constraint. `bun:sqlite` is synchronous, so this
 * takes a plain query callback rather than a promise-returning one.
 */
export const detectSqliteOauthClientIdCollisions = (
  query: (sql: string) => readonly unknown[]
): readonly OauthClientIdCollisionRow[] => {
  const table = query(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'auth_oauth_client'`
  )
  if (table.length === 0) return []

  const unique = query(
    `SELECT il.name AS name
     FROM pragma_index_list('auth_oauth_client') il
     JOIN pragma_index_info(il.name) ii
     WHERE il."unique" = 1
     GROUP BY il.name
     HAVING COUNT(*) = 1 AND MAX(ii.name) = 'client_id'`
  )
  if (unique.length > 0) return []

  const rows = query(
    `SELECT client_id, COUNT(*) AS n
     FROM auth_oauth_client
     GROUP BY client_id
     HAVING COUNT(*) > 1
     ORDER BY n DESC, client_id`
  ) as readonly Record<string, unknown>[]
  return rows.map(toCollisionRow)
}
