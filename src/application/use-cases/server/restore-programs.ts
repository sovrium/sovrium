/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { join } from 'node:path'
import { Data, Effect } from 'effect'
import { BackupWorkspace } from '@/application/ports/services/backup-workspace'
import { compareVersions } from '@/domain/kernel/markdown/release-notes-selection'
import {
  KEY_ENTRY,
  KEY_ENVIRONMENT_VARIABLE,
  MANIFEST_ENTRY,
  POSTGRES_ENTRY,
  PROJECT_PREFIX,
  SQLITE_ENTRY,
  STORAGE_PREFIX,
  parseBackupManifest,
  type BackupManifest,
} from './backup-manifest'
import type { BackupIoError } from '@/application/ports/services/backup-workspace'

/** Everything `sovrium restore` was asked, resolved to absolute paths. */
export interface RestoreRequest {
  readonly archivePath: string
  /** Where the config tree goes: the current directory. */
  readonly projectDirectory: string
  /** `--data-dir`, else `SOVRIUM_DATA_DIR`, else `./.sovrium`. */
  readonly dataDirectory: string
  /** `SOVRIUM_LOCK_DIR`, else the data directory — the lock `sovrium stop` reads. */
  readonly lockDirectory: string
  /** Where local uploads go: `STORAGE_LOCAL_DIRECTORY`, else `<data dir>/storage`. */
  readonly storageDirectory: string
  readonly force: boolean
  readonly engineVersion: string
  /** `DATABASE_URL` when it names a PostgreSQL database. */
  readonly postgresUrl: string | undefined
  /** `SOVRIUM_ENCRYPTION_KEY` when set and non-empty. */
  readonly environmentKey: string | undefined
}

/** What was restored, for the report. */
export interface RestoreSummary {
  readonly manifest: BackupManifest
  /** `SQLite (<path>)` or `PostgreSQL`. */
  readonly database: string
  /** The written key file, or `undefined` when the backup carries no key. */
  readonly keyPath: string | undefined
  readonly configFiles: number
  readonly storageFiles: number
  readonly verified: number
  /** Things the operator must act on, one sentence each. */
  readonly warnings: readonly string[]
}

/**
 * A condition that stops the restore before its first write. `reason` is
 * the clause the CLI completes with "— nothing was restored."
 */
export class RestoreRefusal extends Data.TaggedError('RestoreRefusal')<{
  readonly reason: string
  readonly guidance: string
}> {}

const refuse = (reason: string, guidance: string) =>
  Effect.fail(new RestoreRefusal({ reason, guidance }))

/** Where one manifest entry lands on disk; `undefined` for the PostgreSQL dump. */
const targetOf = (path: string, request: RestoreRequest): string | undefined => {
  if (path === SQLITE_ENTRY) return join(request.dataDirectory, 'database.db')
  if (path === KEY_ENTRY) return join(request.dataDirectory, KEY_ENTRY)
  if (path.startsWith(PROJECT_PREFIX)) {
    return join(request.projectDirectory, path.slice(PROJECT_PREFIX.length))
  }
  if (path.startsWith(STORAGE_PREFIX)) {
    return join(request.storageDirectory, path.slice(STORAGE_PREFIX.length))
  }
  return undefined
}

/** Steps 1 and 2: a readable manifest, taken by this engine or an older one. */
const readManifest = (request: RestoreRequest) =>
  Effect.gen(function* () {
    const workspace = yield* BackupWorkspace
    const entries = yield* workspace.readArchive(request.archivePath)
    const manifest = parseBackupManifest(entries?.get(MANIFEST_ENTRY))
    if (entries === undefined || manifest === undefined) {
      return yield* refuse(
        `The file ${request.archivePath} is not a Sovrium backup`,
        "Pass a file written by 'sovrium backup'."
      )
    }
    if (compareVersions(manifest.engineVersion, request.engineVersion) > 0) {
      return yield* refuse(
        `The backup was taken by Sovrium v${manifest.engineVersion} and this is Sovrium v${request.engineVersion}`,
        `Restore it with sovrium v${manifest.engineVersion} or later ('sovrium update').`
      )
    }
    return { entries, manifest }
  })

/** Steps 3 and 4: no live server on the target, and nothing to overwrite unless forced. */
const checkTarget = (request: RestoreRequest, manifest: BackupManifest) =>
  Effect.gen(function* () {
    const workspace = yield* BackupWorkspace
    if (yield* workspace.isServerRunning(request.lockDirectory)) {
      return yield* refuse(
        `A server is running on ${request.dataDirectory}`,
        "Stop it with 'sovrium stop', then run 'sovrium restore' again."
      )
    }
    if (request.force) return undefined
    if (yield* workspace.isDirectoryOccupied(request.dataDirectory)) {
      return yield* refuse(
        `The data directory ${request.dataDirectory} is not empty`,
        'Pass --force to replace what it holds, or restore into an empty directory with --data-dir.'
      )
    }
    const configTargets = manifest.files
      .filter((file) => file.path.startsWith(PROJECT_PREFIX))
      .flatMap((file) => targetOf(file.path, request) ?? [])
    const existing = yield* Effect.filter(configTargets, (target) => workspace.pathExists(target))
    if (existing[0] !== undefined) {
      return yield* refuse(
        `The config file ${existing[0]} already exists`,
        "Pass --force to replace it, or run 'sovrium restore' from an empty directory."
      )
    }
    return undefined
  })

/** Step 5: every listed entry present, at its recorded size and sha256. */
const verifyChecksums = (entries: ReadonlyMap<string, Uint8Array>, manifest: BackupManifest) =>
  Effect.gen(function* () {
    const workspace = yield* BackupWorkspace
    const verdicts = yield* Effect.forEach(manifest.files, (file) => {
      const bytes = entries.get(file.path)
      if (bytes === undefined) return Effect.succeed({ path: file.path, ok: false })
      return Effect.map(workspace.sha256(bytes), (sha256) => ({
        path: file.path,
        ok: sha256 === file.sha256 && bytes.byteLength === file.size,
      }))
    })
    const damaged = verdicts.find((verdict) => !verdict.ok)
    if (damaged !== undefined) {
      return yield* refuse(
        `The entry ${damaged.path} does not match its checksum in the manifest, so the archive is damaged`,
        'Restore from another copy of the backup.'
      )
    }
    return verdicts.length
  })

/** The database the archive holds must have somewhere to go on this machine. */
const checkDatabaseTarget = (request: RestoreRequest, manifest: BackupManifest) =>
  Effect.gen(function* () {
    const workspace = yield* BackupWorkspace
    if (manifest.database.path === SQLITE_ENTRY) {
      return request.postgresUrl === undefined
        ? undefined
        : yield* refuse(
            'The backup holds a SQLite database and DATABASE_URL names a PostgreSQL one',
            'Unset DATABASE_URL to restore the SQLite database into the data directory.'
          )
    }
    if (request.postgresUrl === undefined) {
      return yield* refuse(
        'The backup holds a PostgreSQL dump and DATABASE_URL names no PostgreSQL database',
        'Set DATABASE_URL to the empty PostgreSQL database to restore into.'
      )
    }
    if (!(yield* workspace.hasExecutable('psql'))) {
      return yield* refuse(
        'The PostgreSQL client tool psql is not on PATH, so the dump cannot be replayed',
        "Install the PostgreSQL client tools (pg_dump and psql), then run 'sovrium restore' again."
      )
    }
    return undefined
  })

/** The operator's two key hazards: no key in the archive, or an environment key that overrides it. */
const keyWarnings = (
  request: RestoreRequest,
  manifest: BackupManifest,
  archivedKey: Uint8Array | undefined
): readonly string[] => {
  if (manifest.encryptionKey.source === 'environment') {
    return [
      `The backup holds no encryption key: set ${KEY_ENVIRONMENT_VARIABLE} to the value it was taken with before 'sovrium start'.`,
    ]
  }
  const fileKey = archivedKey === undefined ? '' : new TextDecoder().decode(archivedKey).trim()
  return request.environmentKey !== undefined && request.environmentKey !== fileKey
    ? [
        `${KEY_ENVIRONMENT_VARIABLE} is set and differs from the restored key, so the stored credentials will not decrypt while it is set.`,
      ]
    : []
}

/** Write every listed entry. Only reached once every check above has passed. */
const writeEntries = (
  request: RestoreRequest,
  manifest: BackupManifest,
  entries: ReadonlyMap<string, Uint8Array>
) =>
  Effect.gen(function* () {
    const workspace = yield* BackupWorkspace
    const hasStorage = manifest.files.some((file) => file.path.startsWith(STORAGE_PREFIX))
    if (request.force && hasStorage) yield* workspace.removePath(request.storageDirectory)
    // A stale write-ahead log beside a replaced database file would be replayed
    // INTO it at the next open — the one way a forced restore could corrupt.
    const databasePath = join(request.dataDirectory, 'database.db')
    yield* workspace.removePath(`${databasePath}-wal`)
    yield* workspace.removePath(`${databasePath}-shm`)
    yield* Effect.forEach(manifest.files, (file) => {
      const bytes = entries.get(file.path) ?? new Uint8Array()
      if (file.path === POSTGRES_ENTRY) {
        return workspace.restorePostgres(request.postgresUrl ?? '', bytes)
      }
      const target = targetOf(file.path, request)
      if (target === undefined) return Effect.void
      return workspace.writeFile(target, bytes, file.path === KEY_ENTRY ? 0o600 : undefined)
    })
  })

/**
 * `sovrium restore`: put a backup back, or refuse with nothing written.
 *
 * The refusals run in the documented order — not a backup, newer engine, live
 * server, occupied target, damaged entry — and the database target check after
 * them; every one of them precedes the first write.
 */
export const restoreBackup = (
  request: RestoreRequest
): Effect.Effect<RestoreSummary, RestoreRefusal | BackupIoError, BackupWorkspace> =>
  Effect.gen(function* () {
    const { entries, manifest } = yield* readManifest(request)
    yield* checkTarget(request, manifest)
    const verified = yield* verifyChecksums(entries, manifest)
    yield* checkDatabaseTarget(request, manifest)
    yield* writeEntries(request, manifest, entries)
    const archivedKey = entries.get(KEY_ENTRY)
    const warnings = keyWarnings(request, manifest, archivedKey)
    const count = (prefix: string): number =>
      manifest.files.filter((file) => file.path.startsWith(prefix)).length
    return {
      manifest,
      database:
        manifest.database.path === SQLITE_ENTRY
          ? `SQLite (${join(request.dataDirectory, 'database.db')})`
          : 'PostgreSQL',
      keyPath: archivedKey === undefined ? undefined : join(request.dataDirectory, KEY_ENTRY),
      configFiles: count(PROJECT_PREFIX),
      storageFiles: count(STORAGE_PREFIX),
      verified,
      warnings,
    }
  }).pipe(Effect.withSpan('server.restore-backup'))
