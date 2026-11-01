/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What `sovrium migrate` reads before and after it applies: the migrations the
 * current build ships, and the ones this database records as applied — read
 * without applying anything, and without creating a SQLite file.
 *
 * Split out of `migrate.ts`, which keeps the migrator itself.
 */

import { existsSync } from 'node:fs'
import { SQL } from 'bun'
import { Effect } from 'effect'
import { DatabaseConnectionError } from '@/application/ports/services/database-migrator'
import { withCauseInMessage } from '@/infrastructure/database/drizzle/with-cause-in-message'
import { postgresClientOptions } from '@/infrastructure/database/sql/postgres-client-options'
import { isCompiled } from '@/infrastructure/process/package-paths'
import { sqliteLockHint } from '../sql/sqlite-pragmas'
import { openSqliteReader } from '../sql/sqlite-reader'
import {
  resolveMigrationsFolder,
  shippedMigrations,
  truncateToSecond,
  type ShippedMigration,
} from './migration-folder'
import type { MigrationError } from './migration-error'
import type { DatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'

/**
 * The driver's own words, not the wrapper's.
 *
 * No `catch:` below is a bare `String(error)`. On a `DrizzleQueryError` that
 * yields `Failed query: <sql>` and nothing else — the driver's message
 * (`relation "auth.oauth_resource" already exists`) lives on `.cause`, one hop
 * away and invisible. That defect class hid the v0.23.0 root cause from
 * everyone reading the logs.
 */
const driverMessage = (error: unknown): string => String(withCauseInMessage(error))

/**
 * Where the shipped set and the database each stand, read WITHOUT applying
 * anything.
 *
 * `runMigrations` reports neither a count nor a name, which is half of why the
 * v0.23.0 outage was unreadable from outside: "did nothing" and "migrated 7 →
 * 14" produced byte-identical output. `sovrium migrate` narrates the difference
 * by reading this before and after, so the applied set is the DIFFERENCE
 * between the two name sets rather than a claim the command makes about itself.
 */
export interface MigrationFolderState {
  readonly dialect: DatabaseDialectConfig['dialect']
  /** The folder drizzle would migrate from — resolved, never the token typed. */
  readonly migrationsFolder: string
  /** Whether the migrations are embedded in a compiled binary, unpacked for this run only. */
  readonly isCompiled: boolean
  /** Every migration folder name the current build ships, in apply order. */
  readonly names: readonly string[]
  /**
   * The names this database records as applied.
   *
   * A SET, not a count. Drizzle v1 decides what to run by NAME membership, so
   * a positional `names.slice(appliedCount)` — correct under 0.45's strictly
   * ordered timestamp model — can now name the wrong migrations outright: a
   * database that skipped one and applied the next would be reported as having
   * applied the one it skipped. May contain a name this build does not ship
   * (a downgrade, or a fork); reported verbatim rather than dropped, and the
   * counts derive from the intersection.
   */
  readonly applied: readonly string[]
}

/** One `__drizzle_migrations` row, as either driver returns it, on either shape. */
interface AppliedRow {
  readonly hash: string
  readonly created_at: string | number | bigint
  readonly name?: string | null
}

/**
 * Map legacy rows onto folder names the way drizzle's own upgrade does.
 *
 * A pre-v1 `__drizzle_migrations` has no `name` column at all, so the only way
 * to say which migrations it holds is to reproduce `upgradeIfNeeded`'s join:
 * truncate the stored millisecond `created_at` to seconds and match it against
 * the folder's own second-precision timestamp, falling back to the sha256 when
 * the timestamp finds nothing. This is a READ — it never writes the column —
 * so the one `--dry-run` an operator runs BEFORE their first v1 boot is
 * accurate instead of reporting a fully-migrated database as empty.
 */
const namesForLegacyRows = (
  shipped: readonly ShippedMigration[],
  rows: readonly AppliedRow[]
): readonly string[] => {
  const byWhen = new Map(shipped.map((entry) => [entry.whenMillis, entry] as const))
  const byHash = new Map(shipped.map((entry) => [entry.hash, entry] as const))

  return rows.flatMap((row) => {
    const matched = byWhen.get(truncateToSecond(row.created_at)) ?? byHash.get(String(row.hash))
    return matched ? [matched.name] : []
  })
}

/**
 * Which migrations this database records, tolerating both table shapes.
 *
 * Existence is probed FIRST rather than catching a failed `SELECT`: an error
 * mid-transaction would poison the session, and "the table is absent" is a
 * legitimate state (a fresh install) rather than a failure to recover from.
 * The `name` COLUMN is probed for the same reason — this runs before drizzle's
 * one-time `upgradeIfNeeded` has had any chance to add it.
 */
const postgresAppliedNames = async (
  query: (sql: string) => Promise<unknown>,
  shipped: readonly ShippedMigration[]
): Promise<readonly string[]> => {
  const present = (await query(
    "SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS present"
  )) as readonly { readonly present: boolean }[]
  if (present[0]?.present !== true) return []

  const columns = (await query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'"
  )) as readonly { readonly column_name: string }[]
  const hasName = columns.some((column) => column.column_name === 'name')

  if (!hasName) {
    return namesForLegacyRows(
      shipped,
      (await query(
        'SELECT hash, created_at FROM drizzle.__drizzle_migrations'
      )) as readonly AppliedRow[]
    )
  }

  const named = (await query(
    'SELECT name FROM drizzle.__drizzle_migrations WHERE name IS NOT NULL'
  )) as readonly { readonly name: string }[]
  return named.map((row) => row.name)
}

/** The SQLite counterpart of {@link postgresAppliedNames}; `bun:sqlite` is synchronous. */
const sqliteAppliedNames = (
  query: (sql: string) => readonly unknown[],
  shipped: readonly ShippedMigration[]
): readonly string[] => {
  const present = query(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'"
  )
  if (present.length === 0) return []

  const columns = query(
    "SELECT name AS column_name FROM pragma_table_info('__drizzle_migrations')"
  ) as readonly { readonly column_name: string }[]
  const hasName = columns.some((column) => column.column_name === 'name')

  if (!hasName) {
    return namesForLegacyRows(
      shipped,
      query('SELECT hash, created_at FROM __drizzle_migrations') as readonly AppliedRow[]
    )
  }

  const named = query('SELECT name FROM __drizzle_migrations WHERE name IS NOT NULL') as readonly {
    readonly name: string
  }[]
  return named.map((row) => row.name)
}

/**
 * The names this database has already applied.
 *
 * Opens its own short-lived connection and closes it. Never CREATES: a SQLite
 * file that does not exist has applied nothing, and answering that by creating
 * it would make every read-only mode a writer — precisely what `--dry-run` and
 * `--check` promise not to be. The apply path is unaffected, since
 * `runSqliteMigrations` creates the file moments later as it always did.
 */
const readAppliedNames = (
  config: DatabaseDialectConfig,
  shipped: readonly ShippedMigration[]
): Effect.Effect<readonly string[], DatabaseConnectionError> => {
  if (config.dialect === 'sqlite') {
    return existsSync(config.path)
      ? Effect.try({
          try: () => {
            // A reader with the busy timeout: `sovrium migrate --dry-run`
            // reporting "locked" where it could simply have waited is the same
            // defect in a quieter place.
            const client = openSqliteReader(config.path)
            try {
              return sqliteAppliedNames((sql) => client.query(sql).all(), shipped)
            } finally {
              client.close()
            }
          },
          catch: (error) =>
            new DatabaseConnectionError({
              message: `SQLite database open failed: ${driverMessage(error)}${sqliteLockHint(error, config.path)}`,
              cause: error,
            }),
        })
      : Effect.succeed([])
  }

  return Effect.tryPromise({
    try: async () => {
      const client = new SQL(postgresClientOptions(config.databaseUrl, { max: 1 }))
      try {
        return await postgresAppliedNames((sql) => client.unsafe(sql), shipped)
      } finally {
        await client.close()
      }
    },
    catch: (error) =>
      new DatabaseConnectionError({
        message: `Database connection failed: ${driverMessage(error)}`,
        cause: error,
      }),
  })
}

/**
 * Read {@link MigrationFolderState} for the resolved dialect: the shipped set from the
 * resolved folder, the applied names from the database; neither side writes anything.
 */
export const readMigrationFolderState = (
  config: DatabaseDialectConfig
  // `MigrationError`: a binary unpacks its migrations, which a read-only or full disk refuses.
): Effect.Effect<MigrationFolderState, DatabaseConnectionError | MigrationError> =>
  Effect.gen(function* () {
    const migrationsFolder = yield* resolveMigrationsFolder(
      config.dialect === 'postgres' ? 'pg' : 'sqlite'
    )
    const shipped = yield* Effect.try({
      try: () => shippedMigrations(migrationsFolder),
      catch: (error) =>
        new DatabaseConnectionError({
          message: `Migrations could not be read at ${migrationsFolder}: ${driverMessage(error)}`,
          cause: error,
        }),
    })

    return {
      dialect: config.dialect,
      migrationsFolder,
      isCompiled,
      names: shipped.map((entry) => entry.name),
      applied: yield* readAppliedNames(config, shipped),
    }
  }).pipe(Effect.scoped) // the unpacked migrations, if any, are removed here
