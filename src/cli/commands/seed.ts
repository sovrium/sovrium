/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium seed [config] [--dir <path>] [--mode …] [--table <name>] [--dry-run]`
 *
 * Loads a folder of `seed/<table>.yaml` files into an app's tables through the
 * same application use-cases the records API calls — one write path, two entry
 * points.
 *
 * ## Why this runs direct rather than over HTTP
 *
 * The demo fleet re-seeds nightly on a host with no Bun and no Node, against an
 * app that is not running, immediately after a golden copy is restored. Going
 * through the REST API would need a listening server, a signed-in admin (three
 * demos run `auth: false` and have none), and would hit the 50-request-per-
 * minute cap on `POST /api/tables/*`. None of those constraints exist here.
 *
 * ## Migration
 *
 * The command runs the SAME two steps `sovrium start` runs, in the same order,
 * before writing anything: `runMigrations` then `initializeSchema`. That is what
 * makes it correct against a fresh database and a stopped app.
 *
 * It deliberately does NOT run boot's best-effort post-schema steps
 * (attachment-URL backfill, connection seeding, agent-user sync, RAG
 * embedding). Those are startup concerns; running them from a verb named `seed`
 * would give the command side effects its name does not promise.
 */

import { stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { Console, Effect } from 'effect'
import { buildSeedPlan } from '@/application/use-cases/seed/seed-plan'
import { SEED_MODES, parseSeedMode } from '@/domain/models/seed'
import { formatDiscoveredConfigNotice } from '@/domain/utils'
import { printDocument } from '@/infrastructure/logging/cli-output'
import { loadSeedFiles } from './seed-load'
import { lazyImportSchema } from './utils'
import type { App } from '@/domain/models/app'
import type { SeedMode } from '@/domain/models/seed'

/** Everything `sovrium seed` reads from the command line. */
export interface SeedCommandOptions {
  readonly configFile: string | undefined
  readonly seedDir: string | undefined
  /** RAW `--mode` value; validated here so the refusal can list the accepted set. */
  readonly mode: string | undefined
  readonly tables: readonly string[]
  readonly dryRun: boolean
}

const DEFAULT_CONFIG_FILE = './app.yaml'
const DEFAULT_SEED_DIR = 'seed'

/** Print to stderr and exit 1. There is no partial-success exit code. */
const refuse = (message: string): never => {
  Effect.runSync(Console.error(message))
  // eslint-disable-next-line functional/no-expression-statements
  process.exit(1)
}

/**
 * Render the per-table report as one document.
 *
 * Dry-run rows stay GLYPH-LESS on purpose: `✓` asserts that something completed,
 * and a row saying what *would* be created has completed nothing. Marking a plan
 * with a success glyph is the same class of lie as reporting a stop that never
 * happened.
 */
const report = (lines: readonly string[]): void => {
  const dryRun = lines.some((line) => line.startsWith('[dry-run]'))
  // The `no changes written` sentinel becomes the ⚠ header, so it is dropped
  // here rather than repeated as a row.
  const rows = lines
    .map((line) => line.replace(/^\[dry-run\] /, ''))
    .filter((line) => line !== 'no changes written')

  printDocument(
    dryRun
      ? [
          [{ glyph: 'warn' as const, text: 'Dry run — nothing was written.' }],
          rows.map((text) => ({ text })),
          [{ text: 'Re-run without --dry-run to apply this plan.' }],
        ]
      : [rows.map((text) => ({ glyph: 'ok' as const, text }))]
  )
}

const indent = (lines: readonly string[]): string => lines.map((line) => `  ${line}`).join('\n')

/** Validate `--mode` before anything is loaded, parsed or migrated. */
const requireMode = (raw: string | undefined): SeedMode => {
  const mode = parseSeedMode(raw)
  if (mode !== undefined) return mode
  return refuse(
    `Error: unrecognised --mode "${raw}". Accepted modes: ${SEED_MODES.join(', ')}.\n` +
      `  if-empty  seed only tables that have no rows (default)\n` +
      `  upsert    replay idempotently, matching on each file's mergeOn\n` +
      `  replace   delete every row, then insert`
  )
}

/**
 * Resolve the seed directory and prove it exists.
 *
 * An explicit `--dir` resolves against the CWD, as any path argument should.
 * The DEFAULT is anchored on the config file's directory rather than the CWD,
 * matching `resolveDefaultPublicDir` and for the same reason: a `seed/` folder
 * belongs to the app it seeds, so `sovrium seed /srv/demos/crm/app.yaml` must
 * find `/srv/demos/crm/seed` no matter which directory the caller happens to be
 * in. The demo fleet invokes the binary from each app's own clone directory,
 * where both anchors resolve identically.
 *
 * The path is reported RESOLVED, never as the token the operator typed:
 * "./seed not found" is unactionable when the working directory belongs to a
 * systemd unit.
 */
const requireSeedDir = async (raw: string | undefined, configFile: string): Promise<string> => {
  const seedDir =
    raw === undefined ? join(dirname(resolve(configFile)), DEFAULT_SEED_DIR) : resolve(raw)
  const stats = await stat(seedDir).catch(() => undefined)
  if (stats?.isDirectory() === true) return seedDir
  return refuse(
    `Error: seed directory not found: ${seedDir}\n` +
      `  Create it, or point at another one with --dir <path>.`
  )
}

/**
 * Resolve the config when no positional one was given.
 *
 * The terminal `?? DEFAULT_CONFIG_FILE` is deliberate: when nothing is found,
 * `requireApp` keeps printing the byte-identical `Error: File not found:
 * ./app.yaml` it printed before discovery existed, so seed's failure contract is
 * untouched. The change is purely additive — `app.yaml` still resolves (it is
 * candidate #1) and `app.yml` / `app.ts` now resolve too.
 */
const discoverConfigFile = async (): Promise<string> => {
  const { discoverDefaultConfigFile } = await lazyImportSchema()
  const discovered = await discoverDefaultConfigFile(process.cwd())
  if (discovered === undefined) return DEFAULT_CONFIG_FILE

  Effect.runSync(Console.error(formatDiscoveredConfigNotice(discovered)))
  return discovered
}

/** Load and decode the app config, refusing with the path the operator typed. */
const requireApp = async (configFile: string): Promise<App> => {
  if (!(await Bun.file(configFile).exists())) {
    return refuse(`Error: File not found: ${configFile}`)
  }

  const { loadSchemaFromFile } = await lazyImportSchema()
  const parsed = await loadSchemaFromFile(configFile).catch((error: unknown) =>
    refuse(
      `Error: Failed to parse ${configFile}: ${error instanceof Error ? error.message : String(error)}`
    )
  )

  const { decodeAppConfigObject } = await import('@/application/use-cases/schema/decode-app-config')
  const decoded = decodeAppConfigObject(parsed)
  return decoded.valid
    ? decoded.app
    : refuse(
        `Error: ${configFile} is not a valid configuration:\n` +
          decoded.errors.map((error) => `  ${error}`).join('\n')
      )
}

/**
 * The two boot steps, and only those two.
 *
 * `runMigrations` must precede `initializeSchema` — the app's own tables carry
 * foreign keys into `auth.user`, which the migrations create.
 */
const migrate = async (app: App): Promise<void> => {
  const { parseDatabaseDialectConfig } =
    await import('@/domain/models/env/database/database-dialect')
  const { runMigrations } = await import('@/infrastructure/database/drizzle/migrate')
  const { initializeSchema } = await import('@/infrastructure/database/schema/schema-initializer')
  return Effect.runPromise(
    Effect.gen(function* () {
      yield* runMigrations(parseDatabaseDialectConfig())
      yield* initializeSchema(app)
    })
  )
}

/**
 * Handle `sovrium seed`.
 *
 * Exits 0 when every targeted table was seeded, skipped by `if-empty`, or
 * reported by `--dry-run`; exits 1 on any refusal or write failure. The exit is
 * explicit because a database connection can outlive the last write and keep
 * the process alive, and `demo-reset.service` waits on the exit code.
 */
export const handleSeedCommand = async (options: SeedCommandOptions): Promise<void> => {
  const mode = requireMode(options.mode)
  const configFile = options.configFile ?? (await discoverConfigFile())
  const app = await requireApp(configFile)
  const seedDir = await requireSeedDir(options.seedDir, configFile)

  const loaded = await migrate(app).then(() => loadSeedFiles(seedDir))
  if (!loaded.ok) return refuse(`Error: seed files could not be read:\n${indent(loaded.errors)}`)

  const planned = buildSeedPlan({
    app,
    files: loaded.files,
    mode,
    requestedTables: options.tables,
    runAt: new Date(),
  })
  if (!planned.ok) return refuse(`Error: seed data was refused:\n${indent(planned.errors)}`)

  const { seedTablesOf } = await import('@/application/use-cases/seed/seed-config')
  // Deferred alongside the imports above, and for the same reason: `seed-write`
  // drags in the whole database + table layer, which no other verb needs. An
  // eager import here put that graph — and every module-load side effect in it
  // — inside `sovrium --help`. It also matters in compiled binary mode, where
  // native .node modules cannot be resolved from Bun's virtual filesystem.
  const { SeedWriteError, executeSeedPlan } = await import('./seed-write')
  const lines = await executeSeedPlan({
    app,
    plan: planned.plan,
    tables: seedTablesOf(app),
    mode,
    seedDir,
    dryRun: options.dryRun,
  }).catch((error: unknown) =>
    refuse(
      error instanceof SeedWriteError
        ? `Error: ${error.message}`
        : `Error: seeding failed: ${error instanceof Error ? error.message : String(error)}`
    )
  )

  report(lines)
  // eslint-disable-next-line functional/no-expression-statements
  process.exit(0)
}
