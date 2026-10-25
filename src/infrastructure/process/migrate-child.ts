/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { isBunfsPath } from './package-paths'

/**
 * Build a database's schema by running `sovrium migrate` in a child process of
 * this same program.
 *
 * ### Why a child and not a function call
 *
 * The database layer is process-wide and dialect-locked: the dialect is read
 * from `DATABASE_URL` once, cached, and every repository, the migrator and the
 * shared connection follow it. A SQLite → PostgreSQL restore needs BOTH
 * schemas built in one command — the backup's SQLite copy brought forward, then
 * the PostgreSQL target — and switching dialect inside one process would mean
 * resetting state nothing was written to reset. A child per database gets each
 * build exactly as `sovrium migrate` builds it, migrations then config tables,
 * with nothing shared.
 *
 * The child is the running program itself: `process.execPath` is the compiled
 * binary, or `bun` followed by the entry script when running from source (the
 * rule `sovrium restart` follows).
 */

/** Ten minutes: a large SQLite copy brought forward rebuilds tables in place. */
const MIGRATE_TIMEOUT_MS = 10 * 60 * 1000

/**
 * The only variables the schema-build child inherits from the operator's
 * environment. A config may come from an archive someone else made, and the
 * build needs none of the operator's storage, mail, AI, auth or encryption
 * secrets: the migrate path reads the database URL and pool size, the data and
 * lock directories (set to the restore's scratch below) and the runtime's own
 * basics. `NODE_EXTRA_CA_CERTS` is the runtime's TLS trust for a database
 * behind a private certificate authority, never a secret.
 *
 * `TMPDIR` is deliberately absent: the child gets a temporary directory of its
 * own inside its data directory ({@link migrateChildTemporaryDirectory}).
 */
export const MIGRATE_CHILD_ENVIRONMENT = [
  'PATH',
  'HOME',
  'TZ',
  'LANG',
  'DATABASE_POOL_MAX',
  'NODE_EXTRA_CA_CERTS',
] as const

/** One schema build: which database, which config, and where the child keeps its own files. */
export interface MigrateChildRequest {
  /** `file:<path>` for SQLite, the PostgreSQL URL otherwise. */
  readonly databaseUrl: string
  readonly configPath: string
  /** A private scratch directory the child may use as its data directory. */
  readonly dataDirectory: string
  readonly workingDirectory: string
}

/** How the child ended: `ok`, or its combined output for the operator. */
export type MigrateChildOutcome =
  { readonly ok: true } | { readonly ok: false; readonly output: string }

/**
 * The child's temporary directory: inside its data directory, and so inside the
 * restore's scratch directory, which is removed in every outcome.
 *
 * The compiled binary unpacks its embedded migrations into a temporary folder
 * and removes it when the build ends. A child stopped part-way — the restore
 * interrupted, or the build timing out — is ended by a signal before that
 * removal runs, and a folder under the operator's own `TMPDIR` stayed there for
 * good. Kept inside the scratch directory, it goes with it.
 */
export const migrateChildTemporaryDirectory = (dataDirectory: string): string =>
  join(dataDirectory, 'tmp')

/** The child's whole environment: the allowlisted variables of `inherited`, then the build's own. */
export const migrateChildEnvironment = (
  inherited: Readonly<Record<string, string | undefined>>,
  request: Pick<MigrateChildRequest, 'databaseUrl' | 'dataDirectory'>
): Record<string, string> => ({
  ...Object.fromEntries(
    MIGRATE_CHILD_ENVIRONMENT.flatMap((name) => {
      const value = inherited[name]
      return value === undefined ? [] : [[name, value]]
    })
  ),
  DATABASE_URL: request.databaseUrl,
  SOVRIUM_DATA_DIR: request.dataDirectory,
  SOVRIUM_LOCK_DIR: request.dataDirectory,
  TMPDIR: migrateChildTemporaryDirectory(request.dataDirectory),
  NO_COLOR: '1',
})

/** A running schema build: the child process, and how it will end. */
export interface MigrateChild {
  readonly process: ReturnType<typeof Bun.spawn>
  readonly outcome: Promise<MigrateChildOutcome>
}

/**
 * Start `sovrium migrate <config>` against one database. The caller owns the
 * child: `stopMigrateChild` ends it and waits, for an interrupted restore.
 */
export const startMigrateChild = (request: MigrateChildRequest): MigrateChild => {
  const entry = process.argv[1]
  const viaScript = entry !== undefined && !isBunfsPath(entry)
  mkdirSync(migrateChildTemporaryDirectory(request.dataDirectory), {
    recursive: true,
    mode: 0o700,
  })
  const child = Bun.spawn(
    [process.execPath, ...(viaScript ? [entry] : []), 'migrate', request.configPath],
    {
      cwd: request.workingDirectory,
      env: migrateChildEnvironment(process.env, request),
      stdin: 'ignore',
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: MIGRATE_TIMEOUT_MS,
    }
  )
  const outcome = Promise.all([
    new Response(child.stdout as ReadableStream).text(),
    new Response(child.stderr as ReadableStream).text(),
    child.exited,
  ]).then(([stdout, stderr, exitCode]): MigrateChildOutcome =>
    exitCode === 0 ? { ok: true } : { ok: false, output: `${stderr}\n${stdout}`.trim() }
  )
  return { process: child, outcome }
}

/**
 * End a child that is still running and wait until it has exited, so nothing
 * it holds (a lock on the database being emptied) outlives it.
 *
 * @total
 */
export const stopMigrateChild = async (child: MigrateChild): Promise<void> => {
  if (child.process.exitCode === null && child.process.signalCode === null) {
    child.process.kill('SIGTERM')
  }
  await child.process.exited
}
