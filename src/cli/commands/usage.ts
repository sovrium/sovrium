/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium usage [config] [--json] [--report <file>]`
 *
 * How many bytes this install holds: its database and its stored files. It
 * reads the install `sovrium start` would boot — same config, `DATABASE_URL`,
 * storage variables and data directory — and changes nothing. A hosting
 * machine's one-shot usage unit runs it with `--report`, as the app.
 *
 * This file resolves the environment and prints; the measure lives in the
 * `measureInstallUsage` use-case.
 */

import { resolve } from 'node:path'
import { Console, Effect } from 'effect'
import {
  measureInstallUsage,
  type UsageStorageSource,
} from '@/application/use-cases/server/usage-programs'
import { parseDatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'
import { parseStorageEnvConfig } from '@/domain/models/process-env/storage/storage'
import { InstallUsageReaderLive } from '@/infrastructure/filesystem/install-usage-reader-live'
import { formatBytes, printFailure } from '@/infrastructure/logging/cli-output'
import { getFlagPathValue } from '../runtime/flag-vocabulary'
import { discoverConfigFile } from './app-prelude'
import type { CatalogueDatabase } from '@/application/ports/services/install-usage-reader'
import type { UsageReport } from '@/domain/models/app/automations/actions/instance/usage'

const fail = (headline: string, guidance: string, detail?: readonly string[]): never => {
  printFailure({ headline, guidance, ...(detail === undefined ? {} : { detail }) })
  process.exit(1)
  return undefined as never
}

/** Where uploads live, read by the parser `sovrium start` uses, with its defaults and refusals. */
const readStorage = (): UsageStorageSource => {
  const storage = parseStorageEnvConfig()
  if (storage.provider === 's3') return { provider: 's3' }
  if (storage.provider === 'local')
    return { provider: 'local', directory: resolve(storage.directory) }
  return { provider: 'database' }
}

/** The database and storage `sovrium start` would use, or the message saying why not. */
const readSources = ():
  | { readonly database: CatalogueDatabase; readonly storage: UsageStorageSource }
  | { readonly error: string } => {
  try {
    const dialect = parseDatabaseDialectConfig()
    const database: CatalogueDatabase =
      dialect.dialect === 'postgres'
        ? { dialect: 'postgres', url: dialect.databaseUrl }
        : { dialect: 'sqlite', path: resolve(dialect.path) }
    return { database, storage: readStorage() }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

const figureLine = (label: string, source: string, bytes: number | null): string =>
  `${label} (${source}): ${bytes === null ? 'not measured' : formatBytes(bytes)}`

/** The terminal form of a report. */
const humanLines = (report: UsageReport): readonly string[] => [
  figureLine('Database', report.database, report.databaseBytes),
  figureLine('Files', report.storage, report.filesBytes),
  ...report.unmeasured.map((entry) => `${entry.figure} not measured: ${entry.reason}`),
]

/** Handle `sovrium usage`. Exits 1 when the install cannot be resolved; a figure it cannot read is `null`. */
export const handleUsageCommand = async (
  givenConfigFile: string | undefined,
  argv: readonly string[]
): Promise<void> => {
  const configFile = givenConfigFile ?? (await discoverConfigFile())
  if (!(await Bun.file(resolve(configFile)).exists())) {
    return fail(
      `The config file ${configFile} does not exist — nothing was measured.`,
      "Run 'sovrium usage' from the project directory, or pass the config path."
    )
  }
  const sources = readSources()
  if ('error' in sources) {
    return fail(
      'The environment does not describe a database and storage to measure.',
      'Correct the variable named above, then run the command again.',
      [sources.error]
    )
  }
  const report = await Effect.runPromise(
    measureInstallUsage({ ...sources, now: new Date() }).pipe(
      Effect.provide(InstallUsageReaderLive)
    )
  )
  const reportPath = getFlagPathValue(argv, '--report')
  if (reportPath !== undefined) {
    await Bun.write(resolve(reportPath), `${JSON.stringify(report, null, 2)}\n`)
    Effect.runSync(Console.log(`Usage report written to ${reportPath}.`))
    return
  }
  const text = argv.includes('--json')
    ? JSON.stringify(report, null, 2)
    : humanLines(report).join('\n')
  Effect.runSync(Console.log(text))
}
