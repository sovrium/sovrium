/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium restore <file> [--data-dir <dir>] [--force]`
 *
 * The inverse of `sovrium backup`: the config tree into the current directory,
 * the database, key and uploads into the data directory. Every refusal — not a
 * backup, newer engine, live server, occupied target, damaged entry — happens
 * before the first byte is written. The order lives in the
 * `restoreBackup` use-case; this file resolves the targets and prints.
 */

import { join, resolve } from 'node:path'
import { Effect, Console } from 'effect'
import {
  restoreBackup,
  type RestoreRequest,
  type RestoreSummary,
} from '@/application/use-cases/server/restore-programs'
import { parseDataDir } from '@/domain/models/process-env/data-dir'
import { parseDatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'
import { BackupWorkspaceLive } from '@/infrastructure/filesystem/backup-workspace-live'
import { CLI_INDENT, inflect, printFailure, printStderr } from '@/infrastructure/logging/cli-output'
import { getCurrentVersion } from './update'

/** Everything `sovrium restore` reads from the command line. */
export interface RestoreCommandOptions {
  readonly archivePath: string | undefined
  readonly dataDir: string | undefined
  readonly force: boolean
}

const fail = (headline: string, guidance: string, detail?: readonly string[]): never => {
  printFailure({ headline, guidance, ...(detail === undefined ? {} : { detail }) })
  process.exit(1)
  return undefined as never
}

/** `DATABASE_URL` when it names PostgreSQL; an unreadable value is refused by the caller. */
const readPostgresUrl = (): string | undefined | { readonly error: string } => {
  try {
    const dialect = parseDatabaseDialectConfig()
    return dialect.dialect === 'postgres' ? dialect.databaseUrl : undefined
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

/** The `Restored …` line and its data block (T22, T24/T25). */
const formatReport = (summary: RestoreSummary, projectDirectory: string, storage: string) =>
  [
    `Restored the backup taken on ${summary.manifest.createdAt.slice(0, 10)} by Sovrium v${summary.manifest.engineVersion}.`,
    '',
    `Database: ${summary.database}`,
    `Encryption key: ${summary.keyPath ?? `not in the backup (set ${summary.manifest.encryptionKey.source === 'environment' ? summary.manifest.encryptionKey.variable : 'SOVRIUM_ENCRYPTION_KEY'})`}`,
    `Config: ${inflect(summary.configFiles, 'file')} (${projectDirectory})`,
    summary.manifest.storage.provider === 'local'
      ? `Storage: ${inflect(summary.storageFiles, 'file')} (${storage})`
      : `Storage: ${summary.manifest.storage.provider}, ${inflect(summary.manifest.storage.files, 'file')} listed, not in the backup`,
    `Checksums: ${summary.verified} of ${summary.verified} verified`,
  ]
    .map((line, index) => (index < 2 ? line : `${CLI_INDENT}${line}`))
    .join('\n')

/** The archive's absolute path, or a refusal when none was named or it is missing. */
const requireArchive = async (archivePath: string | undefined): Promise<string> => {
  if (archivePath === undefined) {
    return fail(
      'No backup file was named — nothing was restored.',
      "Pass the archive 'sovrium backup' wrote: sovrium restore <file>."
    )
  }
  const absolute = resolve(archivePath)
  if (!(await Bun.file(absolute).exists())) {
    return fail(
      `The file ${absolute} does not exist — nothing was restored.`,
      'Check the path to the backup, then run the command again.'
    )
  }
  return absolute
}

/** Resolve every target from the command line and the environment. */
const buildRequest = async (
  options: RestoreCommandOptions,
  archivePath: string
): Promise<RestoreRequest> => {
  const postgresUrl = readPostgresUrl()
  if (typeof postgresUrl === 'object') {
    return fail(
      'DATABASE_URL does not name a database Sovrium can restore into — nothing was restored.',
      'Correct DATABASE_URL, or unset it to restore into SQLite.',
      [postgresUrl.error]
    )
  }
  const dataDirectory = options.dataDir === undefined ? parseDataDir() : resolve(options.dataDir)
  return {
    archivePath,
    projectDirectory: process.cwd(),
    dataDirectory,
    lockDirectory: process.env.SOVRIUM_LOCK_DIR || dataDirectory,
    storageDirectory: process.env.STORAGE_LOCAL_DIRECTORY
      ? resolve(process.env.STORAGE_LOCAL_DIRECTORY)
      : join(dataDirectory, 'storage'),
    force: options.force,
    engineVersion: await getCurrentVersion(),
    postgresUrl,
    environmentKey: process.env.SOVRIUM_ENCRYPTION_KEY || undefined,
  }
}

/** Handle `sovrium restore`. Exits 1 on any refusal; returns on success. */
export const handleRestoreCommand = async (options: RestoreCommandOptions): Promise<void> => {
  const request = await buildRequest(options, await requireArchive(options.archivePath))
  const outcome = await Effect.runPromise(
    restoreBackup(request).pipe(Effect.provide(BackupWorkspaceLive), Effect.result)
  )

  if (outcome._tag === 'Failure') {
    const { failure } = outcome
    return failure._tag === 'RestoreRefusal'
      ? fail(`${failure.reason} — nothing was restored.`, failure.guidance)
      : fail(
          `Sovrium could not ${failure.action}, and the restore stopped there.`,
          'Fix the cause above, then run the command again with --force.',
          [failure.cause instanceof Error ? failure.cause.message : String(failure.cause)]
        )
  }

  Effect.runSync(
    Console.log(formatReport(outcome.success, request.projectDirectory, request.storageDirectory))
  )
  outcome.success.warnings.forEach((warning) => printStderr(`Warning: ${warning}`))
}
