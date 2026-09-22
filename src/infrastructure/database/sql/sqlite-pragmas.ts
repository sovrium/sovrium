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
 * Apply Sovrium's SQLite connection PRAGMAs to an open database.
 *
 * Every connection this process opens goes through here, so a connection
 * cannot be opened with a different set by omission. See the module docblock
 * for why the order is what it is.
 */
export const applySqlitePragmas = (client: BunSqlite, options: SqlitePragmaOptions = {}): void => {
  // FIRST, and deliberately so: the WAL switch below takes a lock of its own,
  // and without a timeout already in force it fails instantly rather than
  // waiting (measured: 0 ms vs 493 ms).
  // eslint-disable-next-line functional/no-expression-statements -- driver-level connection setup; bun:sqlite exec returns void
  client.exec(`PRAGMA busy_timeout = ${options.busyTimeoutMs ?? SQLITE_BUSY_TIMEOUT_MS}`)
  if (options.readOnly === true) return

  // eslint-disable-next-line functional/no-expression-statements -- driver-level connection setup; FK enforcement must be on before any FK-bearing DDL or DML
  client.exec('PRAGMA foreign_keys = ON')
  // eslint-disable-next-line functional/no-expression-statements -- WAL journaling so a reader is not blocked by the writer; persistent in the file, so idempotent per connection
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
