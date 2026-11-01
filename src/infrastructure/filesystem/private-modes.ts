/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The permission bits of what the server keeps for the service account alone.
 *
 * The usual `022` umask makes a new file `0644` and a new directory `0755`:
 * readable by every account on the machine. The database, its journal, the
 * files the local storage provider stores, a backup archive and a key file
 * all hold records or secrets, so each is created with one of these instead.
 * On Windows `chmod` only toggles the read-only flag, and both leave the owner
 * able to write.
 */

import { chmodSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

/** A private file: read and written by its owner only. */
export const PRIVATE_FILE_MODE = 0o600

/** A private directory: entered, listed and written by its owner only. */
export const PRIVATE_DIRECTORY_MODE = 0o700

/**
 * Create `directory` (and its missing parents) private to the owner. A
 * directory that already existed keeps its mode: it may be the working
 * directory, or one the operator chose. The one this call created is set
 * explicitly, whatever the umask.
 */
export const ensurePrivateDirectory = (directory: string): void => {
  const existed = existsSync(directory)
  mkdirSync(directory, { recursive: true, mode: PRIVATE_DIRECTORY_MODE })
  if (!existed) chmodSync(directory, PRIVATE_DIRECTORY_MODE)
}

/**
 * The files whose presence makes a directory the server's own data directory:
 * the default SQLite database and the generated key file.
 */
const OWNED_DATA_FILES = ['database.db', 'encryption-key'] as const

/**
 * Tighten the data directory to `0700` when the server owns it, and say whether
 * it did. A data directory an earlier version created kept the umask's `0755`,
 * and {@link ensurePrivateDirectory} leaves an existing directory alone; this is
 * the one place an existing directory is narrowed. It is owned when it holds
 * the database or the key file. A directory holding neither (one the operator
 * chose for other files) and the working directory are never touched, and a
 * directory this account cannot chmod is left as it is: the server still runs.
 */
export const tightenOwnedDataDirectory = (directory: string, cwd = process.cwd()): boolean => {
  if (resolve(directory) === resolve(cwd)) return false
  if (!OWNED_DATA_FILES.some((file) => existsSync(join(directory, file)))) return false
  try {
    const stats = statSync(directory)
    if (!stats.isDirectory() || (stats.mode & 0o777) === PRIVATE_DIRECTORY_MODE) return false
    chmodSync(directory, PRIVATE_DIRECTORY_MODE)
    return true
  } catch {
    // A directory another account owns refuses the chmod; its mode is that
    // account's to set, and refusing to start over it would be the worse outcome.
    return false
  }
}

/**
 * Make the SQLite database at `path` and its `-wal` and `-shm` companions
 * private to the owner, those that exist. SQLite gives a journal it creates
 * the main file's mode, so a file set private before the journal switch keeps
 * its journal private too.
 */
export const restrictSqliteFiles = (path: string): void => {
  ;[path, `${path}-wal`, `${path}-shm`]
    .filter((file) => existsSync(file))
    .forEach((file) => chmodSync(file, PRIVATE_FILE_MODE))
}

/**
 * Open the SQLite database at `path` with `open`, private to the owner: its
 * directory created `0700` first (`bun:sqlite` makes the file, not its
 * directory), the files set `0600` once it exists. The in-memory sentinel has
 * no file, and is only opened.
 */
export const openPrivateSqlite = <T>(path: string, open: () => T): T => {
  if (path === ':memory:') return open()
  ensurePrivateDirectory(dirname(path))
  const opened = open()
  restrictSqliteFiles(path)
  return opened
}
