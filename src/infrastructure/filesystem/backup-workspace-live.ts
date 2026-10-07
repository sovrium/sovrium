/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative, sep } from 'node:path'
import { Database } from 'bun:sqlite'
import { Effect, Layer } from 'effect'
import { BackupIoError, BackupWorkspace } from '@/application/ports/services/backup-workspace'
import { isProcessRunning, lockFilePathIn } from '@/infrastructure/server/lock-file'

const isMissing = (cause: unknown): boolean =>
  (cause as { readonly code?: string } | null)?.code === 'ENOENT'

/** Run a promise thunk, mapping any rejection to a {@link BackupIoError} naming `action`. */
const attempt = <A>(action: string, run: () => Promise<A>) =>
  Effect.tryPromise({ try: run, catch: (cause) => new BackupIoError({ action, cause }) })

const readIfExists = async (path: string): Promise<Uint8Array | undefined> => {
  try {
    return new Uint8Array(await readFile(path))
  } catch (cause) {
    if (isMissing(cause)) return undefined
    throw cause
  }
}

const listFilesBelow = async (directory: string): Promise<readonly string[]> => {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true }).catch(
    (cause: unknown) => {
      if (isMissing(cause)) return []
      throw cause
    }
  )
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(directory, join(entry.parentPath, entry.name)).split(sep).join('/'))
    .toSorted()
}

/**
 * `VACUUM INTO` a scratch file and read it back. SQLite's own copy: consistent
 * under WAL while the server keeps writing, and allowed on a read-only handle,
 * so the backup never takes a write lock on a live database.
 */
const snapshot = async (databasePath: string): Promise<Uint8Array> => {
  const scratch = await mkdtemp(join(tmpdir(), 'sovrium-backup-'))
  const target = join(scratch, 'database.db')
  try {
    const database = new Database(databasePath, { readonly: true })
    try {
      database.run('PRAGMA busy_timeout = 5000')
      database.run('VACUUM INTO ?', [target])
    } finally {
      database.close()
    }
    return new Uint8Array(await readFile(target))
  } finally {
    await rm(scratch, { recursive: true, force: true })
  }
}

/** Run a PostgreSQL client tool to completion, refusing on a non-zero exit. */
const runClientTool = async (
  argv: readonly string[],
  stdin: Uint8Array | undefined
): Promise<Uint8Array> => {
  const child = Bun.spawn([...argv], {
    stdin: stdin === undefined ? 'ignore' : new Blob([new Uint8Array(stdin)]),
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [output, errors, exitCode] = await Promise.all([
    new Response(child.stdout).arrayBuffer(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  if (exitCode !== 0) {
    throw new Error(`${argv[0]} exited with code ${exitCode}: ${errors.trim()}`)
  }
  return new Uint8Array(output)
}

const countSqliteCatalogue = (path: string): number => {
  const database = new Database(path, { readonly: true })
  try {
    const row = database
      .query<{ readonly n: number }, []>('SELECT count(*) AS n FROM system_file_storage_metadata')
      .get()
    return row?.n ?? 0
  } finally {
    database.close()
  }
}

const countPostgresCatalogue = async (url: string): Promise<number> => {
  const sql = new Bun.SQL(url)
  try {
    const rows: readonly { readonly n: number }[] =
      await sql`SELECT count(*)::int AS n FROM system.file_storage_metadata`
    return rows[0]?.n ?? 0
  } finally {
    await sql.close()
  }
}

/**
 * The archive's permission bits: readable and writable by its owner only. It
 * carries every row and, usually, the encryption key, so the umask (`0644`
 * under the usual `022`) would hand it to every local account.
 */
export const ARCHIVE_FILE_MODE = 0o600

/**
 * Write to a sibling scratch name, then rename: a failed write leaves nothing at
 * `path`. The scratch file is CREATED with {@link ARCHIVE_FILE_MODE} by the same
 * call that writes its bytes, so no window exists in which the archive is
 * readable by anyone else — a `chmod` afterwards would leave one. A stale
 * scratch file is removed first: `wx` refuses to reuse it, because an existing
 * file would keep whatever mode it was created with.
 */
export const writeArchiveAtomically = async (
  path: string,
  entries: ReadonlyMap<string, Uint8Array>
): Promise<number> => {
  const partial = `${path}.partial-${process.pid}`
  try {
    await mkdir(dirname(path), { recursive: true })
    const bytes = await new Bun.Archive(Object.fromEntries(entries), { compress: 'gzip' }).bytes()
    await rm(partial, { force: true })
    await writeFile(partial, bytes, { mode: ARCHIVE_FILE_MODE, flag: 'wx' })
    await rename(partial, path)
    return (await stat(path)).size
  } catch (cause) {
    await rm(partial, { force: true })
    throw cause
  }
}

/** The bytes of a tar or tar.gz as a path → bytes map; `undefined` when it is not one. */
const readArchiveEntries = async (
  path: string
): Promise<ReadonlyMap<string, Uint8Array> | undefined> => {
  const bytes = await readFile(path)
  const files = await new Bun.Archive(bytes).files().catch(() => undefined)
  if (files === undefined) return undefined
  const pairs = await Promise.all(
    [...files].map(async ([entry, file]): Promise<readonly [string, Uint8Array]> => [
      entry,
      new Uint8Array(await file.arrayBuffer()),
    ])
  )
  return new Map(pairs)
}

const writeOne = async (path: string, bytes: Uint8Array, mode: number | undefined) => {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, bytes, mode === undefined ? undefined : { mode })
  // `mode` on writeFile applies only when the file is CREATED; a forced restore
  // over an existing key must still leave it readable by its owner only.
  if (mode !== undefined) await chmod(path, mode)
}

const lockedByLiveServer = async (lockDirectory: string): Promise<boolean> => {
  const content = await readIfExists(lockFilePathIn(lockDirectory))
  if (content === undefined) return false
  const pid = ((): number | undefined => {
    try {
      const parsed = JSON.parse(new TextDecoder().decode(content)) as { readonly pid?: unknown }
      return typeof parsed.pid === 'number' ? parsed.pid : undefined
    } catch {
      return undefined
    }
  })()
  return pid !== undefined && isProcessRunning(pid)
}

const loadGraph = async (configPath: string) => {
  const { loadSchemaGraphFromFile } = await import('@/infrastructure/config')
  const graph = await loadSchemaGraphFromFile(configPath)
  const { name } = graph.config as { readonly name?: unknown }
  return {
    name: typeof name === 'string' && name.length > 0 ? name : undefined,
    files: [...new Set(graph.files)],
  }
}

/**
 * The filesystem, SQLite, PostgreSQL-client and tar implementation of the
 * backup port. Nothing here leaves the machine except the PostgreSQL client
 * tools' own connection to the database `DATABASE_URL` names.
 */
export const BackupWorkspaceLive = Layer.succeed(BackupWorkspace, {
  loadConfigGraph: (configPath: string) =>
    attempt(`read the config ${configPath}`, () => loadGraph(configPath)),
  readFileIfExists: (path: string) => attempt(`read ${path}`, () => readIfExists(path)),
  listFiles: (directory: string) => attempt(`list ${directory}`, () => listFilesBelow(directory)),
  isDirectoryOccupied: (directory: string) =>
    attempt(`list ${directory}`, () =>
      readdir(directory).then(
        (entries) => entries.length > 0,
        (cause: unknown) => {
          if (isMissing(cause)) return false
          throw cause
        }
      )
    ),
  pathExists: (path: string) =>
    attempt(`read ${path}`, () =>
      lstat(path).then(
        () => true,
        (cause: unknown) => {
          if (isMissing(cause)) return false
          throw cause
        }
      )
    ),
  snapshotSqlite: (databasePath: string) =>
    attempt(`copy the SQLite database ${databasePath}`, () => snapshot(databasePath)),
  hasExecutable: (name: string) => Effect.sync(() => Bun.which(name) !== null),
  dumpPostgres: (databaseUrl: string) =>
    attempt('dump the PostgreSQL database with pg_dump', () =>
      runClientTool(
        ['pg_dump', '--no-owner', '--no-privileges', '--format=plain', `--dbname=${databaseUrl}`],
        undefined
      )
    ),
  restorePostgres: (databaseUrl: string, dump: Uint8Array) =>
    attempt('replay the PostgreSQL dump with psql', () =>
      runClientTool(
        [
          'psql',
          '--quiet',
          '--single-transaction',
          '--set=ON_ERROR_STOP=1',
          `--dbname=${databaseUrl}`,
        ],
        dump
      ).then(() => undefined)
    ),
  countCatalogueFiles: (database) =>
    database.dialect === 'sqlite'
      ? Effect.try({
          try: () => countSqliteCatalogue(database.path),
          catch: (cause) => new BackupIoError({ action: 'count the stored files', cause }),
        })
      : attempt('count the stored files', () => countPostgresCatalogue(database.url)),
  sha256: (bytes: Uint8Array) =>
    Effect.sync(() => new Bun.CryptoHasher('sha256').update(bytes).digest('hex')),
  writeArchive: (path: string, entries: ReadonlyMap<string, Uint8Array>) =>
    attempt(`write ${path}`, () => writeArchiveAtomically(path, entries)),
  readArchive: (path: string) => attempt(`read ${path}`, () => readArchiveEntries(path)),
  writeFile: (path: string, bytes: Uint8Array, mode?: number) =>
    attempt(`write ${path}`, () => writeOne(path, bytes, mode)),
  removePath: (path: string) =>
    attempt(`remove ${path}`, () => rm(path, { recursive: true, force: true })),
  isServerRunning: (lockDirectory: string) =>
    attempt(`read the lock in ${lockDirectory}`, () => lockedByLiveServer(lockDirectory)),
})
