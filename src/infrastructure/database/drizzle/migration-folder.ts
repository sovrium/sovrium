/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Where the shipped migrations live, and what they are called.
 *
 * Split out of `migrate.ts` (which applies them) so that resolution and reading
 * have one home rather than three: the migrator, the read-only pre-flight and
 * the CLI all need the same folder and the same name list, and each of them
 * used to derive it separately.
 *
 * ## The v1 layout, and why the journal is gone
 *
 * Up to drizzle 0.45 a migration set was a flat directory of `<tag>.sql` files
 * plus `meta/_journal.json`, and identity was the journal entry's `when`
 * timestamp. Drizzle v1 replaced both: a set is now one directory per
 * migration, named `<YYYYMMDDHHMMSS>_<name>`, each holding a single
 * `migration.sql`. `readMigrationFiles` derives everything from that name —
 * order by `localeCompare`, `folderMillis` from the leading 14 digits parsed as
 * UTC (so second, not millisecond, precision) — and **throws outright** if it
 * finds a `meta/_journal.json`, which is why nothing in this repo may write one.
 *
 * That is also why the folder probe below looks for a `migration.sql` rather
 * than for the directory: `drizzle/` exists in every checkout, and `drizzle/`
 * containing a v1 set is the only thing that makes it the right answer.
 *
 * ## One `readMigrationFiles` call site
 *
 * {@link shippedMigrations} is the ONLY place in `src/` that reads a migration
 * set off disk. Hashing or ordering the files by hand here would be a second
 * implementation of drizzle's own identity rules, and a divergence would show
 * up as every migration looking drifted — so drizzle's reader is used verbatim
 * and its output re-shaped, never re-derived.
 *
 * Callers wanting only the names map over it. A `shippedNames` convenience was
 * written and then removed: nothing consumed it, and an unused export is a
 * second thing to keep true.
 */

import { existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import { Effect } from 'effect'
import { materializeMigrations } from '@/infrastructure/assets/embedded-static-assets'
import { isCompiled } from '@/infrastructure/process/package-paths'
import { MigrationError } from './migration-error'

/** One migration as the current build ships it. */
export interface ShippedMigration {
  /** The folder name — the exact value drizzle writes to `__drizzle_migrations.name`. */
  readonly name: string
  /** The leading 14 digits as UTC millis. SECOND precision: always `…000`. */
  readonly whenMillis: number
  /** sha256 of the whole `migration.sql`, computed by drizzle's own reader. */
  readonly hash: string
  /**
   * How many statements the shipped `migration.sql` holds.
   *
   * Drizzle's reader has already split the file on `--> statement-breakpoint`
   * into `entry.sql`, so this is that array with the empties discarded — a
   * trailing breakpoint, or a file that is only a comment, yields a blank
   * member that is not a statement anyone runs.
   *
   * Read by the boot ledger, which reports what each recorded migration did
   * without opening the migrations directory a second time.
   */
  readonly statements: number
}

/**
 * The dialect subdirectory under `drizzle/`.
 *
 *   - `''`       → `drizzle/`        (PostgreSQL — `drizzle-kit generate`)
 *   - `'sqlite'` → `drizzle/sqlite/` (SQLite — the sqlite-dialect kit config)
 */
const dialectSubdir = (dialect: 'pg' | 'sqlite'): string => (dialect === 'sqlite' ? 'sqlite' : '')

/** The folder path, relative to a root, for a dialect subdirectory. */
const folderFor = (subdir: string): string => (subdir ? join('drizzle', subdir) : 'drizzle')

/**
 * Does this root hold a v1 migration set for the dialect?
 *
 * The predicate is drizzle's own: at least one immediate subdirectory holding a
 * `migration.sql`. Probing for the `drizzle/` DIRECTORY instead would answer
 * `true` from any checkout root — including one whose `drizzle/` holds only
 * `sqlite/` — and probing for `meta/_journal.json` (what this did under 0.45)
 * would now answer `false` everywhere, silently sending every resolution to the
 * CWD fallback.
 */
const hasMigrations = (dir: string, subdir: string): boolean => {
  const folder = join(dir, folderFor(subdir))
  if (!existsSync(folder)) return false
  try {
    return readdirSync(folder, { withFileTypes: true }).some(
      (entry) => entry.isDirectory() && existsSync(join(folder, entry.name, 'migration.sql'))
    )
  } catch {
    return false
  }
}

const ancestors = (start: string, depth: number): readonly string[] =>
  depth <= 0
    ? [start]
    : (() => {
        const parent = resolve(start, '..')
        return parent === start ? [start] : [start, ...ancestors(parent, depth - 1)]
      })()

/**
 * Resolve the on-disk migrations folder for a dialect.
 *
 * Checks in order:
 * 1. CWD-relative (works when sovrium IS the project root)
 * 2. Relative to this file's package root, walking up 5 ancestors (works when
 *    sovrium is a dependency)
 */
const findMigrationsFolder = (subdir: string): string => {
  const packageDir = ancestors(import.meta.dir, 5).find((dir) => hasMigrations(dir, subdir))
  return packageDir ? join(packageDir, folderFor(subdir)) : resolve(folderFor(subdir))
}

/**
 * Resolve the drizzle migrations folder for a dialect.
 *
 * In a compiled binary the `drizzle/` files are not on disk beside the
 * executable — they are embedded — so {@link materializeMigrations} writes them
 * to a temp dir laid out the way drizzle's folder-based migrator expects. In
 * dev/bundled mode the on-disk folder is resolved via {@link findMigrationsFolder}.
 */
export const resolveMigrationsFolder = (
  dialect: 'pg' | 'sqlite'
): Effect.Effect<string, MigrationError> =>
  isCompiled
    ? // Writes the embedded migration files out to a temp directory, so it
      // fails on a read-only or full filesystem. Declared rather than left as a
      // defect: the caller's next step is the migrator itself, which reports a
      // failure the operator can act on, and "the migrations could not be
      // unpacked" belongs in the same place as "the migrations did not apply".
      Effect.tryPromise({
        try: () => materializeMigrations(dialect),
        catch: (error) =>
          new MigrationError({
            message: `Could not unpack the embedded ${dialect} migrations: ${String(error)}`,
            cause: error,
          }),
      })
    : Effect.sync(() => findMigrationsFolder(dialectSubdir(dialect)))

/**
 * Every migration the current build ships, in the order drizzle applies them.
 *
 * Throws if the folder cannot be read, or if it still holds a `meta/_journal.json`
 * (drizzle's own refusal — a v0 tree cannot be read by a v1 migrator). Callers
 * that must survive that wrap it.
 */
export const shippedMigrations = (migrationsFolder: string): readonly ShippedMigration[] =>
  readMigrationFiles({ migrationsFolder }).map((entry) => ({
    name: entry.name,
    whenMillis: entry.folderMillis,
    hash: entry.hash,
    statements: entry.sql.filter((statement) => statement.trim().length > 0).length,
  }))

/**
 * A legacy `created_at`, reduced to the value it can be compared against.
 *
 * A pre-v1 `__drizzle_migrations` row stores the journal's MILLISECOND `when`,
 * while a v1 folder name carries only seconds. Drizzle reconciles the two by
 * truncating the stored value, and this reproduces that exactly — a join on the
 * raw value matches nothing on a legacy table, which would read as "this
 * database has applied nothing" rather than as a bug.
 */
export const truncateToSecond = (createdAt: string | number | bigint): number =>
  Math.floor(Number(createdAt) / 1000) * 1000
