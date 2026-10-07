/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { dirname, isAbsolute, join, relative, sep } from 'node:path'
import { Data, Effect } from 'effect'
import { BackupWorkspace } from '@/application/ports/services/backup-workspace'
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  ENV_FILE_EXCLUSION,
  KEY_ENTRY,
  KEY_ENVIRONMENT_VARIABLE,
  MANIFEST_ENTRY,
  POSTGRES_ENTRY,
  PROJECT_PREFIX,
  SQLITE_ENTRY,
  STORAGE_PREFIX,
  defaultArchiveName,
  type BackupManifest,
  type BackupManifestStorage,
} from './backup-manifest'
import type { BackupIoError } from '@/application/ports/services/backup-workspace'

/** Where the database lives, as the process environment resolved it. */
export type BackupDatabaseSource =
  | { readonly dialect: 'sqlite'; readonly path: string }
  | { readonly dialect: 'postgres'; readonly url: string }

/** Where the encryption key comes from, as the process environment resolved it. */
export type BackupKeySource =
  { readonly source: 'file'; readonly path: string } | { readonly source: 'environment' }

/** Where uploaded files live, as the process environment resolved it. */
export type BackupStorageSource =
  | { readonly provider: 'local'; readonly directory: string }
  | { readonly provider: 's3'; readonly bucket: string }
  | { readonly provider: 'database' }

/** Everything `sovrium backup` was asked, resolved to absolute paths. */
export interface BackupRequest {
  readonly configPath: string
  /** `--output`, absolute; `undefined` names a dated file in `workingDirectory`. */
  readonly outputPath: string | undefined
  readonly workingDirectory: string
  readonly engineVersion: string
  readonly now: Readonly<Date>
  readonly database: BackupDatabaseSource
  readonly encryptionKey: BackupKeySource
  readonly storage: BackupStorageSource
}

/** What was written. */
export interface BackupSummary {
  readonly archivePath: string
  readonly archiveBytes: number
  readonly manifest: BackupManifest
}

/**
 * A condition that stops the backup before the archive exists. `reason` is
 * the clause the CLI completes with "— nothing was written."
 */
export class BackupRefusal extends Data.TaggedError('BackupRefusal')<{
  readonly reason: string
  readonly guidance: string
}> {}

const refuse = (reason: string, guidance: string) =>
  Effect.fail(new BackupRefusal({ reason, guidance }))

/** `a/b/c` regardless of the platform separator. */
const toEntryPath = (path: string): string => path.split(sep).join('/')

/** The `project/<relative>` entries, or a refusal for a `$ref` outside the config directory. */
const collectConfigEntries = (configPath: string) =>
  Effect.gen(function* () {
    const workspace = yield* BackupWorkspace
    const configDir = dirname(configPath)
    const graph = yield* workspace.loadConfigGraph(configPath)
    const outside = graph.files.find((file) => {
      const rel = relative(configDir, file)
      return rel.startsWith('..') || isAbsolute(rel)
    })
    if (outside !== undefined) {
      return yield* refuse(
        `The $ref target ${outside} is outside the config directory ${configDir}, so it could not be restored to the same place`,
        `Move it under ${configDir} and point the $ref at its new path, then run 'sovrium backup' again.`
      )
    }
    const entries = yield* Effect.forEach(graph.files, (file) =>
      Effect.map(workspace.readFileIfExists(file), (bytes) => ({
        path: `${PROJECT_PREFIX}${toEntryPath(relative(configDir, file))}`,
        bytes: bytes ?? new Uint8Array(),
      }))
    )
    return { name: graph.name, entries }
  })

/** The one database entry, and the manifest path naming it. */
interface DatabaseEntry {
  readonly path: BackupManifest['database']['path']
  readonly bytes: Uint8Array
}

/** The database entry: an online SQLite copy, or a `pg_dump` plain-SQL dump. */
const collectDatabaseEntry = (database: BackupDatabaseSource) =>
  Effect.gen(function* () {
    const workspace = yield* BackupWorkspace
    if (database.dialect === 'postgres') {
      const dump: DatabaseEntry = {
        path: POSTGRES_ENTRY,
        bytes: yield* workspace.dumpPostgres(database.url),
      }
      return dump
    }
    if (!(yield* workspace.pathExists(database.path))) {
      return yield* refuse(
        `There is no database at ${database.path}`,
        "Start the app once with 'sovrium start' so it creates its database, or point SOVRIUM_DATA_DIR at the data directory to back up."
      )
    }
    const copy: DatabaseEntry = {
      path: SQLITE_ENTRY,
      bytes: yield* workspace.snapshotSqlite(database.path),
    }
    return copy
  })

/** The key entry when the key is a file; nothing when the environment supplies it. */
const collectKeyEntries = (encryptionKey: BackupKeySource) =>
  Effect.gen(function* () {
    if (encryptionKey.source === 'environment') return []
    const workspace = yield* BackupWorkspace
    const bytes = yield* workspace.readFileIfExists(encryptionKey.path)
    if (bytes === undefined) {
      return yield* refuse(
        `There is no encryption key at ${encryptionKey.path}`,
        `Start the app once with 'sovrium start' so it generates its key, or set ${KEY_ENVIRONMENT_VARIABLE}.`
      )
    }
    return [{ path: KEY_ENTRY, bytes }]
  })

/** The uploads entries and the manifest's storage record. */
const collectStorage = (storage: BackupStorageSource, database: BackupDatabaseSource) =>
  Effect.gen(function* () {
    const workspace = yield* BackupWorkspace
    if (storage.provider === 'local') {
      const files = yield* workspace.listFiles(storage.directory)
      const entries = yield* Effect.forEach(files, (file) =>
        Effect.map(workspace.readFileIfExists(join(storage.directory, file)), (bytes) => ({
          path: `${STORAGE_PREFIX}${file}`,
          bytes: bytes ?? new Uint8Array(),
        }))
      )
      const record: BackupManifestStorage = { provider: 'local', path: STORAGE_PREFIX }
      return { entries, record }
    }
    const count = yield* workspace.countCatalogueFiles(database)
    const record: BackupManifestStorage =
      storage.provider === 's3'
        ? { provider: 's3', bucket: storage.bucket, files: count, included: false }
        : { provider: 'database', files: count, included: false }
    return { entries: [], record }
  })

/** Refuse what cannot be backed up BEFORE anything is read or any connection opened. */
const preflight = (database: BackupDatabaseSource) =>
  Effect.gen(function* () {
    const workspace = yield* BackupWorkspace
    if (database.dialect === 'postgres' && !(yield* workspace.hasExecutable('pg_dump'))) {
      return yield* refuse(
        'The PostgreSQL client tool pg_dump is not on PATH, so the database cannot be dumped',
        "Install the PostgreSQL client tools (pg_dump and psql), then run 'sovrium backup' again."
      )
    }
    if (database.dialect === 'sqlite' && database.path === ':memory:') {
      return yield* refuse(
        'The database is in memory and has nothing on disk to copy',
        'Point DATABASE_URL at a file, or leave it unset for the default SQLite file.'
      )
    }
    return undefined
  })

/**
 * `sovrium backup`: one gzipped tar holding the database, the key, the config
 * tree and the local uploads, with a manifest of every entry's sha256.
 *
 * Every refusal happens before the archive exists, and the archive is written
 * atomically, so a failed backup never leaves a file an operator might trust.
 */
export const createBackup = (
  request: BackupRequest
): Effect.Effect<BackupSummary, BackupRefusal | BackupIoError, BackupWorkspace> =>
  Effect.gen(function* () {
    yield* preflight(request.database)
    const workspace = yield* BackupWorkspace
    const config = yield* collectConfigEntries(request.configPath)
    const database = yield* collectDatabaseEntry(request.database)
    const keyEntries = yield* collectKeyEntries(request.encryptionKey)
    const storage = yield* collectStorage(request.storage, request.database)
    const entries = [database, ...keyEntries, ...config.entries, ...storage.entries]
    const files = yield* Effect.forEach(entries, (entry) =>
      Effect.map(workspace.sha256(entry.bytes), (sha256) => ({
        path: entry.path,
        size: entry.bytes.byteLength,
        sha256,
      }))
    )
    const configRel = relative(dirname(request.configPath), request.configPath)
    const appName = config.name ?? configRel.replace(/\.[^.]+$/, '')
    const manifest: BackupManifest = {
      format: BACKUP_FORMAT,
      formatVersion: BACKUP_FORMAT_VERSION,
      engineVersion: request.engineVersion,
      createdAt: request.now.toISOString(),
      app: { name: appName, config: `${PROJECT_PREFIX}${toEntryPath(configRel)}` },
      database: { dialect: request.database.dialect, path: database.path },
      encryptionKey:
        request.encryptionKey.source === 'file'
          ? { source: 'file', path: KEY_ENTRY }
          : { source: 'environment', variable: KEY_ENVIRONMENT_VARIABLE, included: false },
      storage: storage.record,
      excluded: [ENV_FILE_EXCLUSION],
      files,
    }
    const archivePath =
      request.outputPath ?? join(request.workingDirectory, defaultArchiveName(appName, request.now))
    const archiveBytes = yield* workspace.writeArchive(
      archivePath,
      new Map([
        [MANIFEST_ENTRY, new TextEncoder().encode(`${JSON.stringify(manifest, undefined, 2)}\n`)],
        ...entries.map((entry): readonly [string, Uint8Array] => [entry.path, entry.bytes]),
      ])
    )
    return { archivePath, archiveBytes, manifest }
  }).pipe(Effect.withSpan('server.create-backup'))
