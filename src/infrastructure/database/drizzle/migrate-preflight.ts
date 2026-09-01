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
 * 3. **A rewritten released migration.** Drizzle stores a sha256 of each `.sql`
 *    file in `__drizzle_migrations` and then decides purely by TIMESTAMP,
 *    never reading that hash back. A released migration edited in place is
 *    therefore invisible to drizzle and fatal to every existing install — the
 *    v0.12.0 incident. The `Released Migration Immutability` gate checks the
 *    REPOSITORY; nothing until now checked a live database.
 *
 * Nothing here de-duplicates or repairs. Deleting one of two colliding
 * authentication rows silently severs a person's login, and "fixing" a stored
 * hash erases the only evidence the operator has.
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SQL } from 'bun'
import { Database as BunSqlite } from 'bun:sqlite'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import { Effect } from 'effect'
import {
  detectPostgresAccountCollisions,
  detectSqliteAccountCollisions,
  type AccountCollisionRow,
} from './account-issuer-preflight'
import { DatabaseConnectionError, resolveMigrationsFolder } from './migrate'
import {
  detectPostgresOauthClientIdCollisions,
  detectSqliteOauthClientIdCollisions,
  type OauthClientIdCollisionRow,
} from './oauth-client-id-preflight'
import type { DatabaseDialectConfig } from '@/domain/models/env/database/database-dialect'

/** One released migration whose stored hash no longer matches the shipped file. */
export interface MigrationHashDrift {
  readonly tag: string
  readonly storedHash: string
  readonly expectedHash: string
}

/** Everything `--check` found. All three empty means "safe to attempt". */
export interface MigrationPreflightReport {
  readonly accountCollisions: readonly AccountCollisionRow[]
  readonly oauthClientCollisions: readonly OauthClientIdCollisionRow[]
  readonly hashDrift: readonly MigrationHashDrift[]
}

/** One row of `__drizzle_migrations`, as either driver returns it. */
interface AppliedMigrationRow {
  readonly hash: string
  readonly created_at: string | number | bigint
}

/**
 * The shipped journal as `(tag, when, sha256)` triples.
 *
 * `readMigrationFiles` returns entries in journal order and computes the same
 * sha256 the migrator stores, but drops the TAG — so the journal is read
 * alongside it and zipped by index. Using drizzle's own reader rather than
 * hashing the files here is deliberate: a divergence between how Sovrium hashes
 * and how drizzle hashes would make every migration look drifted.
 */
const shippedMigrations = (
  migrationsFolder: string
): readonly { readonly tag: string; readonly when: number; readonly hash: string }[] => {
  const journal = JSON.parse(
    readFileSync(join(migrationsFolder, 'meta', '_journal.json'), 'utf-8')
  ) as { readonly entries: readonly { readonly tag: string }[] }

  return readMigrationFiles({ migrationsFolder }).map((entry, index) => ({
    tag: journal.entries[index]?.tag ?? `entry ${index}`,
    when: entry.folderMillis,
    hash: entry.hash,
  }))
}

/**
 * Compare each applied row's stored hash against the shipped file's.
 *
 * Joined on `created_at` ↔ `folderMillis`, because that timestamp is drizzle's
 * own identity for a migration — the tag is never written to the database, so it
 * exists only in the journal. An applied row matching no journal entry is
 * IGNORED rather than reported: that is a migration this build does not ship (a
 * downgrade, or a fork), a different finding this check is not entitled to make.
 */
const findHashDrift = (
  migrationsFolder: string,
  applied: readonly AppliedMigrationRow[]
): readonly MigrationHashDrift[] => {
  const byWhen = new Map(
    shippedMigrations(migrationsFolder).map((entry) => [String(entry.when), entry])
  )

  return applied.flatMap((row) => {
    const shipped = byWhen.get(String(row.created_at))
    if (shipped === undefined || shipped.hash === String(row.hash)) return []
    return [{ tag: shipped.tag, storedHash: String(row.hash), expectedHash: shipped.hash }]
  })
}

/** Read the applied rows, tolerating a database that has never been migrated. */
const postgresApplied = async (
  query: (sql: string) => Promise<unknown>
): Promise<readonly AppliedMigrationRow[]> => {
  const present = (await query(
    "SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS present"
  )) as readonly { readonly present: boolean }[]
  if (present[0]?.present !== true) return []
  return (await query(
    'SELECT hash, created_at FROM drizzle.__drizzle_migrations'
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
  return query(
    'SELECT hash, created_at FROM __drizzle_migrations'
  ) as readonly AppliedMigrationRow[]
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
    // eslint-disable-next-line functional/no-expression-statements -- releasing the probe connection
    await client.close()
  }
}

/** Every probe, against one SQLite database. */
const sqlitePreflight = (path: string, migrationsFolder: string): MigrationPreflightReport => {
  // `create: false`: `--check` must not bring a database into existence merely
  // by asking after it. A missing file is a legitimate "nothing applied yet".
  const client = new BunSqlite(path, { create: false, readonly: true })
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
): Effect.Effect<MigrationPreflightReport, DatabaseConnectionError> =>
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
