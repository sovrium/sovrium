/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium backup [config] [--output <file>]`
 *
 * One gzipped tar holding everything an install needs to come back: the
 * database (an online SQLite copy, or a `pg_dump` plain-SQL dump), the
 * encryption key when it lives in the data directory, the config tree and the
 * local uploads — each listed in `manifest.json` with its sha256. The `.env`
 * file is never included.
 *
 * This file reads the process environment into absolute sources and prints the
 * result; the order of the work and every refusal live in the `createBackup`
 * use-case.
 */

import { resolve } from 'node:path'
import { Effect } from 'effect'
import {
  createBackup,
  type BackupRefusal,
  type BackupDatabaseSource,
  type BackupKeySource,
  type BackupStorageSource,
} from '@/application/use-cases/server/backup-programs'
import { CliRefusal, fromAsyncValue, refuseCommand, type CliStop } from '@/cli/runtime/run-command'
import { defaultEncryptionKeyPath } from '@/domain/models/process-env/data-dir'
import { BackupWorkspaceLive } from '@/infrastructure/filesystem/backup-workspace-live'
import { formatBytes, inflect, printLine, printStderr } from '@/infrastructure/logging/cli-output'
import { readInstallSources } from '../runtime/install-sources'
import { discoverConfigFile } from './app-prelude'
import { getCurrentVersion } from './update'
import type { BackupIoError } from '@/application/ports/services/backup-workspace'
import type { BackupManifest } from '@/application/use-cases/server/backup-manifest'

/** Everything `sovrium backup` reads from the command line. */
export interface BackupCommandOptions {
  readonly configFile: string | undefined
  readonly outputPath: string | undefined
}

/** The three sources, read from the environment, or the message saying why they could not be. */
type Sources =
  | {
      readonly database: BackupDatabaseSource
      readonly encryptionKey: BackupKeySource
      readonly storage: BackupStorageSource
    }
  | { readonly error: string }

/**
 * Resolve where the database, the key and the uploads live — the same parsers
 * `sovrium start` uses, so a backup reads exactly the install a start would
 * boot. The SQLite path is passed as configured: unlike `sovrium usage`, which
 * makes it absolute, the backup copies the file through SQLite from this same
 * working directory, so both name the same database.
 */
const readSources = (): Sources => {
  const sources = readInstallSources()
  if ('error' in sources) return sources
  const { database, storage } = sources
  const encryptionKey: BackupKeySource = process.env.SOVRIUM_ENCRYPTION_KEY
    ? { source: 'environment' }
    : { source: 'file', path: defaultEncryptionKeyPath(process.env) }
  const storageSource: BackupStorageSource =
    storage.provider === 's3'
      ? { provider: 's3', bucket: storage.bucket }
      : storage.provider === 'local'
        ? { provider: 'local', directory: resolve(storage.directory) }
        : { provider: 'database' }
  return { database, encryptionKey, storage: storageSource }
}

const fail = (headline: string, guidance: string, detail?: readonly string[]): never =>
  refuseCommand({ headline, guidance, ...(detail === undefined ? {} : { detail }) })

/** The stderr notes: what the archive deliberately does not hold, and what to keep safe. */
const omissionNotes = (manifest: BackupManifest): readonly string[] => [
  'The .env file is not in the backup: keep its secrets in your own secret store.',
  ...(manifest.encryptionKey.source === 'environment'
    ? [
        `The encryption key is not in the backup: keep ${manifest.encryptionKey.variable} safe, the restored data cannot be decrypted without it.`,
      ]
    : []),
  ...(manifest.storage.provider === 'local'
    ? []
    : [
        `${inflect(manifest.storage.files, 'stored file')} in ${manifest.storage.provider === 's3' ? `the S3 bucket ${manifest.storage.bucket ?? ''}` : 'the database'} ${manifest.storage.files === 1 ? 'is' : 'are'} listed, not copied${manifest.storage.provider === 'database' ? ' (they travel inside the dump)' : ': back the bucket up with your storage provider'}.`,
      ]),
]

/** What `createBackup` is asked for, once the config and the sources are known to be there. */
const backupRequest = async (options: BackupCommandOptions) => {
  const configFile = options.configFile ?? (await discoverConfigFile())
  const configPath = resolve(configFile)
  if (!(await Bun.file(configPath).exists())) {
    return fail(
      `The config file ${configFile} does not exist — nothing was written.`,
      "Run 'sovrium backup' from the project directory, or pass the config path."
    )
  }
  const sources = readSources()
  if ('error' in sources) {
    return fail(
      'The environment does not describe a database and storage to back up — nothing was written.',
      'Correct the variable named above, then run the command again.',
      [sources.error]
    )
  }
  return {
    configPath,
    outputPath: options.outputPath === undefined ? undefined : resolve(options.outputPath),
    workingDirectory: process.cwd(),
    engineVersion: await getCurrentVersion(),
    now: new Date(),
    ...sources,
  }
}

/** The refusal a failed backup ends with. */
const refusalOf = (failure: BackupRefusal | BackupIoError): CliRefusal =>
  failure._tag === 'BackupRefusal'
    ? new CliRefusal({
        headline: `${failure.reason} — nothing was written.`,
        guidance: failure.guidance,
      })
    : new CliRefusal({
        headline: `Sovrium could not ${failure.action} — nothing was written.`,
        guidance: 'Check that the path exists and is readable, then run the command again.',
        detail: [failure.cause instanceof Error ? failure.cause.message : String(failure.cause)],
      })

/** Handle `sovrium backup`. Exits 1 on any refusal; returns on success. */
export const handleBackupCommand = (options: BackupCommandOptions): Effect.Effect<void, CliStop> =>
  Effect.gen(function* () {
    const request = yield* fromAsyncValue(() => backupRequest(options))
    const { archivePath, archiveBytes, manifest } = yield* createBackup(request).pipe(
      Effect.provide(BackupWorkspaceLive),
      Effect.mapError(refusalOf)
    )
    printLine(
      `Backup written to ${archivePath} (${inflect(manifest.files.length, 'file')}, ${formatBytes(archiveBytes)}).`
    )
    omissionNotes(manifest).forEach((note) => printStderr(note))
  })
