/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium seed [config] [--dir <path>] [--mode …] [--table <name>] [--as <email>]
 *   [--today <YYYY-MM-DD>] [--dry-run]`
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
import { buildSeedPlan } from '@/application/use-cases/seed/seed-plan'
import { SEED_MODES, parseSeedMode, pinRunAtToDay } from '@/domain/models/seed'
import { printDocument } from '@/infrastructure/logging/cli-output'
import { applyDatabaseMigrations, discoverConfigFile, refuse, requireApp } from './app-prelude'
import { loadSeedFiles } from './seed-load'
import type { AccountPlan } from './seed-accounts'
import type { SeedPlan } from '@/application/use-cases/seed/seed-plan'
import type { App } from '@/domain/models/app'
import type { SeedAccount, SeedMode } from '@/domain/models/seed'

/** Everything `sovrium seed` reads from the command line. */
export interface SeedCommandOptions {
  readonly configFile: string | undefined
  readonly seedDir: string | undefined
  /** RAW `--mode` value; validated here so the refusal can list the accepted set. */
  readonly mode: string | undefined
  readonly tables: readonly string[]
  readonly dryRun: boolean
  /** `--as <email>` — the account every row is written as. */
  readonly as?: string | undefined
  /** `--today <YYYY-MM-DD>` — wins over `SOVRIUM_SEED_TODAY`. */
  readonly today?: string | undefined
}

const DEFAULT_SEED_DIR = 'seed'

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
 * The instant every `{{today…}}` / `{{now…}}` in this run renders against.
 *
 * `--today` wins over `SOVRIUM_SEED_TODAY`, so a one-off run can override a
 * pinned day set for the host. A value that is not a real calendar day is
 * refused, naming where it came from, rather than falling back to the clock —
 * a fixture that silently seeds today's dates instead of the pinned ones looks
 * right until someone compares it with the drawing.
 */
const requireRunAt = (flag: string | undefined): Readonly<Date> => {
  const clock = new Date()
  const [raw, source] =
    flag !== undefined ? [flag, '--today'] : [Bun.env.SOVRIUM_SEED_TODAY, 'SOVRIUM_SEED_TODAY']
  if (raw === undefined || raw === '') return clock
  return (
    pinRunAtToDay(raw, clock) ??
    refuse(`Error: ${source} "${raw}" is not a calendar day. Expected YYYY-MM-DD, e.g. 2026-09-24.`)
  )
}

/** Settle every account question for the run, refusing before anything is written. */
const requireAccountPlan = async (
  app: Readonly<App>,
  loaded: { readonly accounts: readonly SeedAccount[] },
  plan: SeedPlan,
  actingAs: string | undefined
) => {
  const { collectAccountReferences } = await import('@/application/use-cases/seed/seed-checks')
  const { planAccounts, readAccountIndex } = await import('./seed-accounts')
  const accountPlan = planAccounts({
    app,
    accounts: loaded.accounts,
    index: await readAccountIndex(),
    references: collectAccountReferences(plan.tables),
    actingAs,
    fallbackPassword: Bun.env.SOVRIUM_SEED_PASSWORD,
  })
  return accountPlan.errors.length > 0
    ? refuse(`Error: seed data was refused:\n${indent(accountPlan.errors)}`)
    : accountPlan
}

/**
 * Create the accounts, then write the rows as the system or the `--as` account.
 *
 * Deferred imports, for the reason the plan's are: `seed-write` drags in the
 * whole database + table layer, which no other verb needs. An eager import here
 * put that graph — and every module-load side effect in it — inside
 * `sovrium --help`. It also matters in compiled binary mode, where native
 * .node modules cannot be resolved from Bun's virtual filesystem.
 */
const writeRun = async (input: {
  readonly app: Readonly<App>
  readonly plan: SeedPlan
  readonly accountPlan: AccountPlan
  readonly mode: SeedMode
  readonly seedDir: string
  readonly options: SeedCommandOptions
}): Promise<readonly string[]> => {
  const { app, accountPlan, options } = input
  const { seedTablesOf } = await import('@/application/use-cases/seed/seed-config')
  const { buildSyntheticSession, buildSystemSession } =
    await import('@/application/use-cases/automations/build-guest-session')
  const { accountReportLines, createPlannedAccounts, readAccountIndex } =
    await import('./seed-accounts')
  const { executeSeedPlan } = await import('./seed-write')

  const accounts = options.dryRun
    ? await readAccountIndex()
    : await createPlannedAccounts(app, accountPlan)
  const actingId = options.as === undefined ? undefined : accounts.get(options.as.toLowerCase())
  const rows = await executeSeedPlan({
    app,
    plan: input.plan,
    tables: seedTablesOf(app),
    mode: input.mode,
    seedDir: input.seedDir,
    dryRun: options.dryRun,
    session: actingId === undefined ? buildSystemSession() : buildSyntheticSession(actingId),
    accounts,
  })
  return [...accountReportLines(accountPlan, options.dryRun), ...rows]
}

/** The message a failed write phase prints, for the errors it knows by name. */
const describeRunFailure = async (error: unknown): Promise<string> => {
  const { SeedWriteError } = await import('./seed-write')
  const { SeedAccountError } = await import('./seed-accounts')
  return error instanceof SeedWriteError || error instanceof SeedAccountError
    ? `Error: ${error.message}`
    : `Error: seeding failed: ${error instanceof Error ? error.message : String(error)}`
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
  const runAt = requireRunAt(options.today)
  const configFile = options.configFile ?? (await discoverConfigFile())
  const { app, authoredTableIds } = await requireApp(configFile)
  const seedDir = await requireSeedDir(options.seedDir, configFile)

  const loaded = await applyDatabaseMigrations(app, { authoredTableIds }).then(() =>
    loadSeedFiles(seedDir)
  )
  if (!loaded.ok) return refuse(`Error: seed files could not be read:\n${indent(loaded.errors)}`)

  const planned = buildSeedPlan({
    app,
    files: loaded.files,
    mode,
    requestedTables: options.tables,
    runAt,
  })
  if (!planned.ok) return refuse(`Error: seed data was refused:\n${indent(planned.errors)}`)

  const accountPlan = await requireAccountPlan(app, loaded, planned.plan, options.as)
  const lines = await writeRun({
    app,
    plan: planned.plan,
    accountPlan,
    mode,
    seedDir,
    options,
  }).catch(async (error: unknown) => refuse(await describeRunFailure(error)))

  report(lines)
  // eslint-disable-next-line functional/no-expression-statements
  process.exit(0)
}
