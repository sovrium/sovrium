/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium import` — migrate an app out of another tool ([internal ref] A14).
 *
 * ```
 * sovrium import fetch <source-uri> [--out <dir>] [--token-env <VAR>] [--only …] [--skip-attachments]
 * sovrium import <snapshot | file> [--config <file>] [--from <tool>] [--only …]
 *                [--dry-run | --write] [--apply] [--prefix <p>] [--json] [--report <file>]
 * sovrium import <source-uri> --write --apply      # fetch, then convert, then seed
 * ```
 *
 * Two stages, the network on one side of a folder and nothing on the other:
 * `fetch` (`import-fetch.ts`) is the only egress; the conversion below reads a
 * snapshot or an export file offline, deterministically, with no AI, and
 * writes files only — config entries or sidecars, and seed files under the
 * gitignored `seed/import/`. A dry run is the default. Every refusal happens
 * before the first byte is written.
 */

import { dirname, resolve } from 'node:path'
import { Effect } from 'effect'
import { IMPORT_REPORT_FORMAT, type ImportReport } from '@/domain/models/import/import-report'
import { findFetchSource } from '@/domain/models/import/import-source'
import { SEED_IMPORT_DIR } from '@/domain/models/import/seed-emission-service'
import { refuse } from './app-prelude'
import { readImportInput, type ImportInput } from './import-input'
import { MigratedPagesLive } from './import-pages-converter'
import { planMigration, type MigrationPlan } from './import-plan'
import {
  convertMigratedPages,
  migratedPagesTargetOf,
  refuseRefusedPages,
} from './import-plan-pages'
import { renderImportReport } from './import-report-text'
import { readConvertRequest, refuseTokenFlag, type ConvertRequest } from './import-request'
import { chooseTool, readSource } from './import-sources'
import { writeMigration } from './import-write'
import { readExistingConnections, type LibraryWrite } from './import-write-library'
import { rootFormatOf } from './library-add-config'
import { lazyImportSchema } from './utils'
import { loadConfigForValidationWithSources } from './validate'
import type { ImportSourceTool } from '@/domain/models/import/import-source'

/** The config to import into: `--config`, else the one discovered in the working directory. */
const resolveConfig = async (config: string | undefined): Promise<string> => {
  if (config !== undefined) {
    const path = resolve(process.cwd(), config)
    return (await Bun.file(path).exists()) ? path : refuse(`Error: No config file at "${config}".`)
  }
  const { discoverDefaultConfigFile } = await lazyImportSchema()
  const discovered = await discoverDefaultConfigFile(process.cwd())
  return discovered === undefined
    ? refuse(`Error: No app config found in ${process.cwd()}. Name one with --config.`)
    : resolve(process.cwd(), discovered)
}

const reportOf = (input: {
  readonly request: ConvertRequest
  readonly read: ImportInput
  readonly tool: ImportSourceTool
  readonly forced: boolean
  readonly plan: MigrationPlan
  readonly written: ImportReport['written']
}): ImportReport => ({
  format: IMPORT_REPORT_FORMAT,
  version: 1,
  source: {
    input: input.request.input,
    tool: input.tool,
    exportKind: input.read.exportKind,
    forced: input.forced,
    ...(input.read.kind === 'snapshot' ? { snapshot: input.read.display } : {}),
  },
  ...(input.written === undefined ? {} : { written: input.written }),
  unmapped: input.plan.unmapped,
  todo: input.plan.todo,
  ...input.plan.sections,
})

/**
 * Run `work` with whatever it prints sent to stderr: the seed run and the
 * migrations it applies log as they go, and stdout carries the report alone —
 * one JSON document under `--json`.
 */
const onStderr = async <A>(work: () => Promise<A>): Promise<A> => {
  const stdout = process.stdout.write.bind(process.stdout)
  const { log } = console
  process.stdout.write = process.stderr.write.bind(process.stderr) as typeof process.stdout.write
  console.log = console.error
  try {
    return await work()
  } finally {
    process.stdout.write = stdout
    console.log = log
  }
}

/** Write, then — with `--apply` — seed what was written. */
const writeAndApply = async (
  request: ConvertRequest,
  configPath: string,
  read: ImportInput & { readonly assets?: ReadonlyMap<string, Uint8Array> },
  { plan, library }: { readonly plan: MigrationPlan; readonly library: LibraryWrite | undefined }
): Promise<ImportReport['written']> => {
  const written = await writeMigration({
    configPath,
    format: rootFormatOf(configPath),
    additions: plan.additions,
    seed: plan.seed,
    snapshotRoot: read.kind === 'snapshot' ? read.path : undefined,
    ...(read.assets === undefined ? {} : { assetBytes: read.assets }),
    ...(library === undefined ? {} : { library }),
    envNames: plan.connectionEnv,
  })
  if (!request.apply || plan.seed === undefined) return written
  const { applyImportedSeed } = await import('./seed-apply')
  const applied = await onStderr(() =>
    applyImportedSeed(configPath, resolve(dirname(configPath), SEED_IMPORT_DIR))
  )
  return { ...written, applied }
}

/**
 * The library's connections and the ones the config already holds, for a
 * source with automations; none at all otherwise, so no other import pays for them.
 */
const connectionsOf = async (hasFlows: boolean, configPath: string, parsed: unknown) => {
  if (!hasFlows) return { library: undefined, connections: { connection: () => undefined } }
  const { loadLibraryConnections } = await import('./library-connections')
  const library = await loadLibraryConnections()
  const existing = await readExistingConnections(configPath, parsed)
  return { library, connections: { connection: library.connection, existing } }
}

/** What writing the plan's library connections reads, when it has any. */
const libraryWriteOf = async (
  plan: MigrationPlan,
  library: LibraryWrite['library'] | undefined,
  parsed: unknown
): Promise<LibraryWrite | undefined> => {
  if (library === undefined || plan.library.length === 0) return undefined
  const { getCurrentVersion } = await import('./update')
  return { connections: plan.library, library, version: await getCurrentVersion(), parsed }
}

/** The input to convert: the path given, or — for a source URI — the snapshot a fetch writes first. */
const inputOf = async (argv: readonly string[], request: ConvertRequest): Promise<string> => {
  if (findFetchSource(request.input) === undefined || (await Bun.file(request.input).exists())) {
    return request.input
  }
  const { runFetch } = await import('./import-fetch')
  return runFetch(argv, ['fetch', request.input])
}

/**
 * The source's pages, converted, when it has any. The page converter runs
 * first: the forms its pages hold join the forms part.
 */
const migratedPagesOf = (
  hasPages: boolean,
  read: ImportInput,
  tool: ImportSourceTool,
  parsed: unknown
) =>
  hasPages
    ? {
        migratedPages: Effect.runSync(
          convertMigratedPages(read, tool, migratedPagesTargetOf(parsed)).pipe(
            Effect.provide(MigratedPagesLive)
          )
        ),
      }
    : {}

/**
 * Handle `sovrium import`.
 *
 * @param argv - the raw arguments after the binary name.
 * @param positional - the positional arguments after `import`.
 */
export const handleImportCommand = async (
  argv: readonly string[],
  positional: readonly string[]
): Promise<void> => {
  refuseTokenFlag(argv)
  if (positional[0] === 'fetch') {
    const { runFetch } = await import('./import-fetch')
    await runFetch(argv, positional)
    return
  }
  const request = readConvertRequest(argv, positional)
  const read = await readImportInput(await inputOf(argv, request))
  const configPath = await resolveConfig(request.config)
  // Judged once, with the migration in place (`planMigration`): a config that only
  // validates once the imported tables exist — a trigger on one of them — is accepted.
  const loaded = await loadConfigForValidationWithSources(configPath)
  const { tool, forced } = chooseTool(read, request.from)
  const source = readSource(read, tool)
  const { library, connections } = await connectionsOf(
    source.flows !== undefined,
    configPath,
    loaded.parsed
  )
  const plan = await planMigration({
    tool,
    source,
    parsed: loaded.parsed,
    refSources: loaded.refSources,
    only: request.only,
    prefix: request.prefix,
    ...connections,
    ...migratedPagesOf(source.pages === true, read, tool, loaded.parsed),
  })
  if (request.write) refuseRefusedPages(plan.sections.pages)
  const written = request.write
    ? await writeAndApply(
        request,
        configPath,
        source.assets === undefined ? read : { ...read, assets: source.assets },
        { plan, library: await libraryWriteOf(plan, library, loaded.parsed) }
      )
    : undefined
  const report = reportOf({ request, read, tool, forced, plan, written })
  const json = `${JSON.stringify(report, undefined, 2)}\n`
  if (request.report !== undefined) await Bun.write(resolve(process.cwd(), request.report), json)
  process.stdout.write(request.json ? json : renderImportReport(report))
}
