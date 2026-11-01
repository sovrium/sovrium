/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { defineFlags, flag } from '@/cli/runtime/flag-schema'
import { lazyImportSchema } from '@/cli/runtime/lazy-modules'
import { refuseCommand, stopCommand, withFlagsAsync } from '@/cli/runtime/run-command'
import {
  formatConfigCandidatesLine,
  formatDiscoveredConfigNotice,
} from '@/domain/kernel/config-parsing/default-config-files'
import {
  audienceReadsField,
  audienceReadsTable,
  declaredAudienceRoles,
  resolveReadAudience,
  type ReadAudience,
} from '@/domain/models/app/tables/read-audience-service'
import { CLIENT_RUNTIME_SOURCE } from '@/infrastructure/assets/embedded-client-runtime.generated'
import { printDocument, printStderr } from '@/infrastructure/logging/cli-output'
import { renderClientFile } from './client/render'
import { getCurrentVersion } from './update'
import { loadConfigForValidationWithSources, validateParsedConfig } from './validate'
import type { ClientTableInput } from './client/render'
import type { App } from '@/domain/models/app'

/**
 * `sovrium client` — write one TypeScript file that calls the app's records
 * API, typed from its own tables, fields and views, with nothing to install.
 *
 * The config is read and checked exactly as `sovrium validate` does it; an
 * invalid one writes nothing. The file names only what its audience may read
 * (`--audience <role|all>`, by default the app's default role, or the visitor
 * on an app with no `auth`): a front-end's source is public, so a table, a
 * field or a view its reader may not read is left out, exactly as the records
 * API does not name it to that reader (`read-audience-service.ts`). The file is generated: it is overwritten on every
 * run, and `--check` compares it to what a run would write without touching it.
 * The runtime is the embedded `client/runtime.ts`, minus its copyright header:
 * the file lands in the user's project and is theirs.
 */

/** Written in the current directory when `--output` names no file. */
const DEFAULT_CLIENT_FILE = 'sovrium-client.ts'

export interface ClientCommandOptions {
  readonly configFile?: string
  /** `--output <file>`. Its directory is created when missing. */
  readonly outputPath?: string
  /** `--check`: write nothing, exit 1 when the file is missing or stale. */
  readonly check?: boolean
  /** `--audience <role|all>`, raw: who the file is for. Absent means the app's default reader. */
  readonly audience?: string
}

const discoverClientConfig = async (): Promise<string> => {
  const { discoverDefaultConfigFile } = await lazyImportSchema()
  const discovered = await discoverDefaultConfigFile(process.cwd())
  if (!discovered) {
    return stopCommand(
      1,
      `Error: No config file provided.\n\n` +
        `${formatConfigCandidatesLine(process.cwd())}\n\n` +
        `Usage:\n  sovrium client <config.json|config.yaml|config.ts>`
    )
  }
  printStderr(formatDiscoveredConfigNotice(discovered))
  return discovered
}

const tablesOf = (parsed: unknown): readonly ClientTableInput[] => {
  const tables =
    typeof parsed === 'object' && parsed !== null ? (parsed as { tables?: unknown }).tables : []
  return Array.isArray(tables) ? (tables as readonly ClientTableInput[]) : []
}

/**
 * The tables `audience` may read, each with only the fields it may read; a
 * table left out takes its views with it.
 */
const readableTables = (
  app: App,
  tables: readonly ClientTableInput[],
  audience: ReadAudience
): readonly ClientTableInput[] =>
  tables
    .filter((table) => audienceReadsTable(app, table.name, audience))
    .map((table) => ({
      ...table,
      fields: (table.fields ?? []).filter((field) =>
        audienceReadsField(app, table.name, field.name, audience)
      ),
    }))

/** The audience `--audience` names, or exit 1 naming the roles the app declares, writing nothing. */
const audienceOf = (app: App, requested: string | undefined): ReadAudience => {
  const audience = resolveReadAudience(app, requested)
  if (audience !== undefined) return audience
  const roles = declaredAudienceRoles(app)
  return refuseCommand({
    headline: `${app.name} declares no role ${requested === '' ? 'with that name' : `named ${requested ?? ''}`} — no client was written.`,
    guidance:
      roles.length === 0
        ? 'The app has no auth, so its only reader is a visitor: pass --audience all, or leave --audience out.'
        : `Pass --audience with one of ${roles.join(', ')}, or all for a visitor who is not signed in.`,
  })
}

/** The file a run would write, or the process exits 1 with the validation report. */
const renderForConfig = async (
  configFile: string,
  requested: string | undefined
): Promise<string> => {
  const { parsed, refSources } = await loadConfigForValidationWithSources(configFile)
  const outcome = await validateParsedConfig(parsed, refSources, resolve(configFile))
  const { decodeAppConfigObject } = await import('@/application/use-cases/config/decode-app-config')
  const decoded = decodeAppConfigObject(parsed)
  if (!outcome.valid || !decoded.valid) {
    return stopCommand(
      1,
      `Error: Validation failed. No client was written.\n\n${outcome.report.join('\n')}`
    )
  }
  return renderClientFile({
    appName: outcome.name,
    version: await getCurrentVersion(),
    runtime: CLIENT_RUNTIME_SOURCE,
    tables: readableTables(decoded.app, tablesOf(parsed), audienceOf(decoded.app, requested)),
  })
}

const readExisting = async (path: string): Promise<string | undefined> => {
  const file = Bun.file(path)
  return (await file.exists()) ? file.text() : undefined
}

const runCheck = async (path: string, shown: string, expected: string): Promise<void> => {
  const existing = await readExisting(path)
  if (existing === expected) {
    printDocument([[{ glyph: 'ok', text: `${shown} is current.` }]])
    return
  }
  return refuseCommand({
    headline: `${shown} is ${existing === undefined ? 'missing' : 'out of date with the config'}.`,
    guidance: `Run 'sovrium client' to write it again.`,
  })
}

const writeClient = async (path: string, shown: string, source: string): Promise<void> => {
  await mkdir(dirname(path), { recursive: true })
    .then(() => writeFile(path, source))
    .catch((error: unknown) => {
      return refuseCommand({
        headline: `Could not write ${shown}.`,
        detail: [error instanceof Error ? error.message : String(error)],
        guidance: 'Check the directory is writable, or pass another file with --output <file>.',
      })
    })
  printDocument([[{ glyph: 'ok', text: shown }]])
}

/** Handle `sovrium client [config] [--output <file>] [--audience <role|all>] [--check]`. */
export const handleClientCommand = async (options: ClientCommandOptions = {}): Promise<void> => {
  const configFile = options.configFile ?? (await discoverClientConfig())
  const source = await renderForConfig(configFile, options.audience)
  const path = resolve(options.outputPath ?? DEFAULT_CLIENT_FILE)
  const shown = relative(process.cwd(), path) || path
  if (options.check === true) {
    await runCheck(path, shown, source)
    return
  }
  await writeClient(path, shown, source)
}

/** The flags `sovrium client` reads beyond the shared ones. */
export const clientFlags = defineFlags({ audience: flag.named('--audience') })

/** `sovrium client`, as the dispatcher runs it: `--audience` given no value reads as `''`. */
export const clientCommand = withFlagsAsync(clientFlags, ({ flags, ...args }) =>
  handleClientCommand({
    configFile: args.configFile,
    outputPath: args.outputPath,
    check: args.check,
    audience: flags.audience.given ? (flags.audience.value ?? '') : undefined,
  })
)
