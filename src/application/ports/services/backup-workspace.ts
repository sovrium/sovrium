/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data, type Effect } from 'effect'

/** A filesystem, archive, database-tool or lock read/write that did not complete. */
export class BackupIoError extends Data.TaggedError('BackupIoError')<{
  /** What was being done, as an operator reads it: `read /srv/app/.sovrium/database.db`. */
  readonly action: string
  readonly cause: unknown
}> {}

/** The config a backup starts from: its declared name and every file it was read from. */
export interface BackupConfigGraph {
  /** `name` as the config declares it, when it declares one. */
  readonly name: string | undefined
  /** Absolute paths, root first, each file once. */
  readonly files: readonly string[]
}

/**
 * Everything `sovrium backup` and `sovrium restore` touch outside the process.
 *
 * ### Why one port and not five
 *
 * The two programs ask small questions of many systems: the config loader, the
 * filesystem, SQLite's own copy, the PostgreSQL client tools, the tar reader
 * and the server lock. Each answer is one call, and the ORDER of those calls is
 * the whole contract (every refusal before the first write). Keeping
 * them behind one service lets the programs hold that order in plain sight,
 * and lets a test replace the whole outside world with one value.
 *
 * Paths are absolute. Directory listings are relative to the directory asked
 * about, `/`-separated, files only.
 */
export class BackupWorkspace extends Context.Service<
  BackupWorkspace,
  {
    /** Load the config graph — the files `sovrium validate` resolves. */
    readonly loadConfigGraph: (
      configPath: string
    ) => Effect.Effect<BackupConfigGraph, BackupIoError>
    /** A file's bytes, or `undefined` when there is no file at that path. */
    readonly readFileIfExists: (
      path: string
    ) => Effect.Effect<Uint8Array | undefined, BackupIoError>
    /** Every file below a directory, recursively; empty when the directory is missing. */
    readonly listFiles: (directory: string) => Effect.Effect<readonly string[], BackupIoError>
    /** Whether a directory exists and holds anything at all. */
    readonly isDirectoryOccupied: (directory: string) => Effect.Effect<boolean, BackupIoError>
    /** Whether anything exists at a path. */
    readonly pathExists: (path: string) => Effect.Effect<boolean, BackupIoError>
    /** A consistent copy of a live SQLite database, taken with SQLite's own `VACUUM INTO`. */
    readonly snapshotSqlite: (databasePath: string) => Effect.Effect<Uint8Array, BackupIoError>
    /** Whether an executable of that name is on `PATH`. Never connects to anything. */
    readonly hasExecutable: (name: string) => Effect.Effect<boolean>
    /** A plain-SQL logical dump of a PostgreSQL database, made by `pg_dump`. */
    readonly dumpPostgres: (databaseUrl: string) => Effect.Effect<Uint8Array, BackupIoError>
    /** Replay a plain-SQL dump into a PostgreSQL database with `psql`, in one transaction. */
    readonly restorePostgres: (
      databaseUrl: string,
      dump: Uint8Array
    ) => Effect.Effect<void, BackupIoError>
    /** How many stored files the database's file catalogue lists. */
    readonly countCatalogueFiles: (
      database:
        | { readonly dialect: 'sqlite'; readonly path: string }
        | { readonly dialect: 'postgres'; readonly url: string }
    ) => Effect.Effect<number, BackupIoError>
    /** Hex sha256 of some bytes. */
    readonly sha256: (bytes: Uint8Array) => Effect.Effect<string>
    /**
     * Write a gzipped tar holding exactly these entries, atomically: a failure
     * leaves no file at `path`. Resolves with the archive's size in bytes.
     */
    readonly writeArchive: (
      path: string,
      entries: ReadonlyMap<string, Uint8Array>
    ) => Effect.Effect<number, BackupIoError>
    /** Every entry of a tar or tar.gz, or `undefined` when the file is not a readable one. */
    readonly readArchive: (
      path: string
    ) => Effect.Effect<ReadonlyMap<string, Uint8Array> | undefined, BackupIoError>
    /** Write a file, creating its parent directories. `mode` applies to the file. */
    readonly writeFile: (
      path: string,
      bytes: Uint8Array,
      mode?: number
    ) => Effect.Effect<void, BackupIoError>
    /** Remove a file or a directory tree; nothing to remove is not an error. */
    readonly removePath: (path: string) => Effect.Effect<void, BackupIoError>
    /**
     * Whether a live server holds the lock in `lockDirectory` — the lock
     * `sovrium stop` reads. A lock whose process has gone is not a live server.
     */
    readonly isServerRunning: (lockDirectory: string) => Effect.Effect<boolean, BackupIoError>
  }
>()('BackupWorkspace') {}
