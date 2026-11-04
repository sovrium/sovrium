/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Database as BunSqlite } from 'bun:sqlite'

/**
 * The one place the SQLite connection PRAGMAs are spelled.
 *
 * Why this module exists
 * ----------------------
 * SQLite allows exactly one writer at a time, and a connection that has NOT
 * been given a busy timeout answers `SQLITE_BUSY: database is locked`
 * **immediately** when another connection holds the file — measured at 1 ms,
 * against 498 ms of patient waiting once a 400 ms timeout is set. So the
 * difference between "the server waits a moment for a briefly-locked database"
 * and "the server refuses to start" is one PRAGMA.
 *
 * The runtime connection (`drizzle/db-bun.ts`) had that PRAGMA. The three
 * connections boot opens BEFORE it did not, and the migrator's in particular
 * set `foreign_keys` and nothing else — so a self-hoster whose database was
 * touched during startup got
 * `Sovrium failed to start: [MigrationError] … SQLiteError: database is locked`
 * instead of a short wait. That happens whenever a `--watch` restart overlaps
 * the outgoing process's shutdown, a `sovrium` CLI command runs against the
 * same data directory, a backup reader triggers a WAL checkpoint, or two
 * instances are pointed at one data directory by mistake.
 *
 * The list existed in three hand-written copies, and a drifted copy is exactly
 * how this bug was written. There is now one.
 *
 * ## Order is load-bearing
 *
 * `busy_timeout` goes FIRST, ahead of the WAL switch. `PRAGMA journal_mode =
 * WAL` needs an exclusive moment of its own, so it is subject to the same lock
 * as everything else: measured against a held lock it failed at **0 ms** with
 * no timeout set and waited **493 ms** with one. Both surviving copies of the
 * list set `busy_timeout` LAST, which left their own WAL switch unprotected —
 * a latent instance of this same defect, fixed by routing them through here.
 *
 * ## WAL on every read-write handle, never on a read-only one
 *
 * WAL journaling is what lets a reader proceed while a writer works, so it is
 * the setting that makes contention survivable rather than merely survivable-
 * after-a-wait. It is also a PERSISTENT property of the database file, so
 * setting it on each read-write connection is idempotent rather than
 * repetitive. A read-only handle gets the busy timeout alone: the WAL switch
 * needs write access to the file and to its `-wal` / `-shm` siblings, and
 * `foreign_keys` governs writes that a read-only handle cannot make.
 *
 * ## `legacy_alter_table` is pinned ON, never inherited
 *
 * The flag decides what `ALTER TABLE <old> RENAME TO <new>` rewrites, and its
 * default is a build option of the SQLite library, not of Sovrium: the system
 * SQLite `bun:sqlite` loads on macOS starts with it ON, the SQLite Bun bundles
 * on Linux with it OFF. Left alone, the same migration ran two different
 * renames: macOS left trigger bodies, views and other tables' `REFERENCES`
 * naming the old relation (`REFERENCES` only while foreign keys are off, as
 * the schema step runs them; with them on, legacy mode still rewrites
 * `REFERENCES`), Linux rewrote all three and re-validated every view
 * of the schema on the way, aborting on any view that named a relation the
 * migration had dropped for the moment.
 *
 * The schema migration is written for the ON behaviour with foreign keys off
 * (`runSqliteSchemaTransaction`), the one that touches nothing but the renamed
 * table: the steps after a rename drop the triggers it
 * carried (`renamed-relation-triggers.ts`, `renamed-table-companions.ts`),
 * rebuild a table whose foreign key names a relation that is no longer a table
 * (`sqlite-foreign-key-target-drift.ts`), rebuild a link table rather than
 * rename it (`link-table-renames.ts`), and rebuild every view at the end. So
 * every read-write connection sets it explicitly, and a migration renames the
 * same way on every platform, Linux production included. A read-only handle
 * runs no `ALTER` and is left alone.
 */

/**
 * How long a connection waits for a locked database before giving up.
 *
 * Five seconds is the value the runtime connection has always used. It is long
 * enough to absorb a restart overlap or a checkpoint and short enough that a
 * genuinely stuck database is still reported inside a supervisor's patience.
 */
export const SQLITE_BUSY_TIMEOUT_MS = 5000

/** How a connection is going to be used, which decides which PRAGMAs apply. */
export interface SqlitePragmaOptions {
  /**
   * Override the busy timeout, in milliseconds.
   *
   * Exists for tests, which need to observe the WAIT without spending
   * {@link SQLITE_BUSY_TIMEOUT_MS} on it. Production callers pass nothing.
   */
  readonly busyTimeoutMs?: number
  /**
   * A read-only handle — busy timeout only.
   *
   * Not merely an optimisation: both other PRAGMAs need write access the
   * handle does not have.
   */
  readonly readOnly?: boolean
}

/**
 * Apply Sovrium's SQLite connection PRAGMAs to an open database: busy
 * timeout, then (read-write only) foreign keys, the rename mode and WAL.
 *
 * Every connection this process opens goes through here, so a connection
 * cannot be opened with a different set by omission. See the module docblock
 * for why the order is what it is.
 */
export const applySqlitePragmas = (client: BunSqlite, options: SqlitePragmaOptions = {}): void => {
  // FIRST, and deliberately so: the WAL switch below takes a lock of its own,
  // and without a timeout already in force it fails instantly rather than
  // waiting (measured: 0 ms vs 493 ms).
  client.exec(`PRAGMA busy_timeout = ${options.busyTimeoutMs ?? SQLITE_BUSY_TIMEOUT_MS}`)
  if (options.readOnly === true) return

  client.exec('PRAGMA foreign_keys = ON')
  // The platform default differs (ON on macOS, OFF on Linux): see the module
  // docblock for why the migration needs it ON everywhere.
  client.exec('PRAGMA legacy_alter_table = ON')
  client.exec('PRAGMA journal_mode = WAL')
}

/** Driver codes that mean "the file is there, something else is holding it". */
const LOCKED_CODES: ReadonlySet<string> = new Set(['SQLITE_BUSY', 'SQLITE_LOCKED'])

/** The `code` of an error-like value, when it carries a string one. */
const codeOf = (node: unknown): string | undefined => {
  if (typeof node !== 'object' || node === null) return undefined
  const { code } = node as { readonly code?: unknown }
  return typeof code === 'string' ? code : undefined
}

/** How far down a `cause` chain to look before giving up. */
const MAX_CAUSE_DEPTH = 10

/**
 * Every node of an error's `cause` chain, depth-capped.
 *
 * The cap is what makes a self-referential chain terminate — those exist, and a
 * diagnostic helper that hangs is worse than one that says nothing.
 */
const causeChain = (node: unknown, depth = 0): readonly unknown[] =>
  node === undefined || node === null || depth >= MAX_CAUSE_DEPTH
    ? []
    : [node, ...causeChain((node as { readonly cause?: unknown }).cause, depth + 1)]

/**
 * True when `error` — or anything in its `cause` chain — is a lock refusal.
 *
 * Code-based rather than message-based, for the reason
 * `@/domain/errors/driver-failure` states at length: a driver's wording is not
 * a contract and a message match breaks in both directions. The chain is walked
 * because drizzle wraps the driver error rather than rethrowing it.
 */
export const isSqliteLocked = (error: unknown): boolean =>
  causeChain(error).some((node) => {
    const code = codeOf(node)
    return code !== undefined && LOCKED_CODES.has(code)
  })

/**
 * The sentence to append when a failure turns out to be a lock refusal, or the
 * empty string when it is anything else.
 *
 * WHAT holds the database is unknowable from inside this process — SQLite
 * reports the refusal and not its author. Naming the file and the wait that
 * already elapsed is the part that is both true and actionable: it tells the
 * operator where to look and rules out "Sovrium is broken" as the explanation.
 *
 * Returns a suffix rather than a whole message so the caller's own typed error
 * keeps saying which step failed.
 */
export const sqliteLockHint = (
  error: unknown,
  path: string,
  busyTimeoutMs: number = SQLITE_BUSY_TIMEOUT_MS
): string =>
  isSqliteLocked(error)
    ? [
        '',
        '',
        `The database is locked: another process is using ${path}.`,
        `Sovrium waited ${busyTimeoutMs / 1000}s for it to be released and it was not.`,
        '',
        'Nothing has been changed. Check for another Sovrium instance, a `sovrium`',
        'command, or a backup or `sqlite3` session holding that file, then start again.',
      ].join('\n')
    : ''
