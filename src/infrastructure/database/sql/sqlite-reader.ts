/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { existsSync } from 'node:fs'
import { Database as BunSqlite } from 'bun:sqlite'
import { applySqlitePragmas } from './sqlite-pragmas'

/**
 * Whether a read-only handle can open `path`: a WAL database needs its `-wal`
 * and `-shm` sidecars to exist, because a read-only handle may not create them.
 *
 * @public
 */
export const sqliteSidecarsPresent = (
  path: string,
  exists: (file: string) => boolean = existsSync
): boolean => exists(`${path}-wal`) && exists(`${path}-shm`)

/**
 * Open an EXISTING SQLite file for reading, never creating it.
 *
 * `{ readonly: true }` alone refuses a WAL database whose sidecars are absent
 * — the state every clean close leaves behind — with `unable to open database
 * file`, which made `sovrium migrate` report an unreachable database after the
 * server had simply stopped. Such a file is opened read-write instead, under
 * `PRAGMA query_only`, so no statement can write; only the sidecars are
 * created. Busy timeout alone either way: the other PRAGMAs write.
 *
 * What the read-write branch does to a production file, so `--check` and
 * `--dry-run` stay safe on one:
 *
 * - **The database file is not written.** Opening and reading leave it
 *   byte-identical; only the `-wal` and `-shm` sidecars are created, and SQLite
 *   gives them the database file's owner and mode, so a check run as root
 *   leaves nothing the service user cannot open.
 * - **A server that starts meanwhile shares the WAL normally.** If this handle
 *   closes last, SQLite checkpoints the frames that server wrote: the ordinary,
 *   crash-safe close of any connection, not a write of ours.
 * - **`query_only` does not cover every PRAGMA.** It refuses every statement
 *   that changes the database, but `PRAGMA journal_mode = …` and
 *   `PRAGMA wal_checkpoint` still run, so a caller issues `SELECT`s and
 *   table-valued pragma reads only.
 * - A directory the caller cannot write fails as before (`unable to open
 *   database file`): the sidecars cannot be created.
 */
export const openSqliteReader = (path: string): BunSqlite => {
  if (sqliteSidecarsPresent(path)) {
    const client = new BunSqlite(path, { create: false, readonly: true })
    applySqlitePragmas(client, { readOnly: true })
    return client
  }
  const client = new BunSqlite(path, { create: false, readwrite: true })
  applySqlitePragmas(client, { readOnly: true })
  client.exec('PRAGMA query_only = ON')
  return client
}
