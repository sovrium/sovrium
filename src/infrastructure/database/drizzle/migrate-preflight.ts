/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The read-only half of the migrator: everything `sovrium migrate --check` asks
 * a database WITHOUT changing it.
 *
 * ## Why this is a separate module from `migrate.ts`
 *
 * `migrate.ts` applies. This inspects. Keeping them apart is not tidiness — it
 * is the structural guarantee behind `--check`'s whole contract: a reader can
 * confirm the mode writes nothing by confirming every statement in this file is
 * a `SELECT`. Two of the three probes are the ones `runMigrations` already runs
 * before it applies; the third has no counterpart there at all.
 *
 * ## The three refusals, and why each is worth a pre-flight
 *
 * 1. **Duplicate account identities.** `drizzle/0011_crazy_beyonder.sql` adds a
 *    UNIQUE index over `(issuer, account_id)`. Colliding rows abort the upgrade
 *    mid-flight, and the operator learns it from a bare `duplicate key value`
 *    at the worst possible moment.
 * 2. **Duplicate OAuth `client_id`s.** Same migration, same class.
 * 3. **A rewritten released migration.** Drizzle stores a sha256 of each
 *    `migration.sql` in `__drizzle_migrations` and then decides what to apply
 *    by NAME, never reading that hash back on the apply path. A released
 *    migration edited in place is therefore invisible to drizzle and fatal to
 *    every existing install — the v0.12.0 incident. It is worse than invisible
 *    on the one-time v0→v1 table upgrade, where the hash IS read: it is the
 *    fallback that names a legacy row whose timestamp finds nothing, so an
 *    edited file can turn a recorded migration into an unmatched one and refuse
 *    the boot outright. The `Released Migration Immutability` gate checks the
 *    REPOSITORY; nothing until now checked a live database.
 *
 * Nothing here de-duplicates or repairs. Deleting one of two colliding
 * authentication rows silently severs a person's login, and "fixing" a stored
 * hash erases the only evidence the operator has.
 */

import { existsSync } from 'node:fs'
import { SQL } from 'bun'
import { Database as BunSqlite } from 'bun:sqlite'
import { Effect } from 'effect'
import { applySqlitePragmas } from '../sql/sqlite-pragmas'
import {
  detectPostgresAccountCollisions,
  detectSqliteAccountCollisions,
  type AccountCollisionRow,
} from './account-issuer-preflight'
import { DatabaseConnectionError } from './migrate'
import { resolveMigrationsFolder, shippedMigrations, truncateToSecond } from './migration-folder'
import {
  detectPostgresOauthClientIdCollisions,
  detectSqliteOauthClientIdCollisions,
  type OauthClientIdCollisionRow,
} from './oauth-client-id-preflight'
import type { MigrationError } from './migration-error'
import type { DatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'

/** One released migration whose stored hash no longer matches the shipped file. */
export interface MigrationHashDrift {
  /** The migration folder name — drizzle's own identity for it under v1. */
  readonly name: string
  readonly storedHash: string
  readonly expectedHash: string
}

/** Everything `--check` found. All three empty means "safe to attempt". */
export interface MigrationPreflightReport {
  readonly accountCollisions: readonly AccountCollisionRow[]
  readonly oauthClientCollisions: readonly OauthClientIdCollisionRow[]
  readonly hashDrift: readonly MigrationHashDrift[]
}

/**
 * One row of `__drizzle_migrations`, as either driver returns it, on either
 * table shape.
 *
 * `name` is OPTIONAL because this pre-flight deliberately runs before drizzle's
 * one-time `upgradeIfNeeded` has had any chance to add the column. Every
 * database that has not yet booted a v1 build — the entire population an
 * upgrade check is for — still has the three-column shape.
 */
interface AppliedMigrationRow {
  readonly hash: string
  readonly created_at: string | number | bigint
  readonly name?: string | null
}

/**
 * Compare each applied row's stored hash against the shipped file's.
 *
 * Joined by NAME where the database has one, because that is drizzle v1's own
 * identity for a migration. A legacy row has no name, so it falls back to the
 * second-truncated `created_at` ↔ folder-timestamp join — the same reconciliation
 * `upgradeIfNeeded` performs, reproduced here rather than skipped: a pre-v1
 * table is exactly the population where an edited released migration is now a
 * boot failure, so reporting "nothing drifted" there would be vacuous in the
 * one place the answer matters most.
 *
 * An applied row matching no shipped migration is IGNORED rather than reported:
 * that is a migration this build does not ship (a downgrade, or a fork), a
 * different finding this check is not entitled to make.
 */
const findHashDrift = (
  migrationsFolder: string,
  applied: readonly AppliedMigrationRow[]
): readonly MigrationHashDrift[] => {
  const shipped = shippedMigrations(migrationsFolder)
  const byName = new Map(shipped.map((entry) => [entry.name, entry] as const))
  const byWhen = new Map(shipped.map((entry) => [entry.whenMillis, entry] as const))

  return applied.flatMap((row) => {
    // A legacy row carries no name at all; a v1 row upgraded from one carries
    // the name the timestamp join produced. Both fall through to the same
    // second-truncated join, which is why this stays a `??` chain rather than a
    // branch on the table shape.
    const match =
      (row.name ? byName.get(row.name) : undefined) ?? byWhen.get(truncateToSecond(row.created_at))
    if (match === undefined || match.hash === String(row.hash)) return []
    return [{ name: match.name, storedHash: String(row.hash), expectedHash: match.hash }]
  })
}

/**
 * Read the applied rows, tolerating a database that has never been migrated AND
 * one that has never been upgraded to the v1 table shape.
 */
const postgresApplied = async (
  query: (sql: string) => Promise<unknown>
): Promise<readonly AppliedMigrationRow[]> => {
  const present = (await query(
    "SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS present"
  )) as readonly { readonly present: boolean }[]
  if (present[0]?.present !== true) return []

  const columns = (await query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'"
  )) as readonly { readonly column_name: string }[]
  const projection = columns.some((column) => column.column_name === 'name')
    ? 'hash, created_at, name'
    : 'hash, created_at'

  return (await query(
    `SELECT ${projection} FROM drizzle.__drizzle_migrations`
  )) as readonly AppliedMigrationRow[]
}

/** The SQLite counterpart of {@link postgresApplied}; `bun:sqlite` is synchronous. */
const sqliteApplied = (
  query: (sql: string) => readonly unknown[]
): readonly AppliedMigrationRow[] => {
  const present = query(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'"
  )
  if (present.length === 0) return []

  const columns = query(
    "SELECT name AS column_name FROM pragma_table_info('__drizzle_migrations')"
  ) as readonly { readonly column_name: string }[]
  const projection = columns.some((column) => column.column_name === 'name')
    ? 'hash, created_at, name'
    : 'hash, created_at'

  return query(`SELECT ${projection} FROM __drizzle_migrations`) as readonly AppliedMigrationRow[]
}

/** Every probe, against one Postgres connection. */
const postgresPreflight = async (
  databaseUrl: string,
  migrationsFolder: string
): Promise<MigrationPreflightReport> => {
  const client = new SQL(databaseUrl)
  try {
    const query = (sql: string): Promise<unknown> => client.unsafe(sql)
    return {
      accountCollisions: await detectPostgresAccountCollisions(query),
      oauthClientCollisions: await detectPostgresOauthClientIdCollisions(query),
      hashDrift: findHashDrift(migrationsFolder, await postgresApplied(query)),
    }
  } finally {
    await client.close()
  }
}

/** Every probe, against one SQLite database. */
const sqlitePreflight = (path: string, migrationsFolder: string): MigrationPreflightReport => {
  // `create: false`: `--check` must not bring a database into existence merely
  // by asking after it. A missing file is a legitimate "nothing applied yet".
  const client = new BunSqlite(path, { create: false, readonly: true })
  // Read-only, so the busy timeout alone: a reader is still refused outright by
  // a writer holding the file, and `sovrium migrate --check` reporting "locked"
  // where it could simply have waited is the same defect in a quieter place.

  applySqlitePragmas(client, { readOnly: true })
  try {
    const query = (sql: string): readonly unknown[] => client.query(sql).all()
    return {
      accountCollisions: detectSqliteAccountCollisions(query),
      oauthClientCollisions: detectSqliteOauthClientIdCollisions(query),
      hashDrift: findHashDrift(migrationsFolder, sqliteApplied(query)),
    }
  } finally {
    client.close()
  }
}

/** Nothing found — the shape returned when there is nothing yet to inspect. */
const NOTHING_FOUND: MigrationPreflightReport = {
  accountCollisions: [],
  oauthClientCollisions: [],
  hashDrift: [],
}

/**
 * Run every read-only pre-flight probe for the resolved dialect.
 *
 * A SQLite file that does not exist yet reports NOTHING FOUND rather than
 * failing: an operator checking before the first migration is asking a fair
 * question, and "no rows can collide because there are no rows" is the honest
 * answer. That tolerance is keyed on the file's ABSENCE, never on catching the
 * open — a blanket catch would report a corrupt database as safe, which is the
 * one answer `--check` must never give.
 */
export const readMigrationPreflight = (
  config: DatabaseDialectConfig
  // `MigrationError` rides along from `readMigrationFolderState`: resolving the
  // folder unpacks the embedded migrations in a compiled binary, which can fail.
): Effect.Effect<MigrationPreflightReport, DatabaseConnectionError | MigrationError> =>
  Effect.gen(function* () {
    const migrationsFolder = yield* resolveMigrationsFolder(
      config.dialect === 'postgres' ? 'pg' : 'sqlite'
    )

    return config.dialect === 'postgres'
      ? yield* Effect.tryPromise({
          try: () => postgresPreflight(config.databaseUrl, migrationsFolder),
          catch: (error) =>
            new DatabaseConnectionError({
              message: `Database connection failed: ${String(error)}`,
              cause: error,
            }),
        })
      : !existsSync(config.path)
        ? NOTHING_FOUND
        : yield* Effect.try({
            try: () => sqlitePreflight(config.path, migrationsFolder),
            catch: (error) =>
              new DatabaseConnectionError({
                message: `SQLite database could not be read: ${String(error)}`,
                cause: error,
              }),
          })
  })
