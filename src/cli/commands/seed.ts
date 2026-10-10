/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium seed [config] [--dir <path>] [--mode …] [--table <name>] [--as <email>]
 *   [--today <YYYY-MM-DD>] [--dry-run] [--request <file>] [--report <file>]`
 *
 * With `--app <slug>` or `--remote`, the command seeds a HOSTED app instead
 * (`seed-remote.ts`), and that branch is taken before anything below runs: no
 * config is loaded and no local database is opened.
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

import { readFile, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { Option, Schema } from 'effect'
import { buildSeedPlan } from '@/application/use-cases/seed/seed-plan'
import { getFlagPathValue } from '@/cli/runtime/flag-vocabulary'
import { seedRunRequestSchema } from '@/domain/models/api/automations/cloud/seed-run'
import {
  SEED_MODES,
  parseSeedMode,
  pinRunAtToDay,
  withholdInvitationLinks,
} from '@/domain/models/seed'
import {
  applyDatabaseMigrations,
  discoverConfigFile,
  lastRefusal,
  refuse,
  requireApp,
} from './app-prelude'
import { resolveProjectRoot } from './option-parsing'
import { loadSeedFiles } from './seed-load'
import { handleRemoteSeed, isRemoteSeed } from './seed-remote'
import { report, seedReportOf, writeReportFile } from './seed-report'
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
  /** The raw command line: `--app`, `--remote`, `--request` and `--report` are read from it. */
  readonly argv?: readonly string[]
}

const DEFAULT_SEED_DIR = 'seed'

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
 * where both anchors resolve identically. An unpacked bundle keeps `seed/`
 * beside `project/`, not inside it, so its config resolves to the bundle root
 * (see `resolveProjectRoot`).
 *
 * The path is reported RESOLVED, never as the token the operator typed:
 * "./seed not found" is unactionable when the working directory belongs to a
 * systemd unit.
 */
const requireSeedDir = async (raw: string | undefined, configFile: string): Promise<string> => {
  const seedDir =
    raw === undefined ? join(resolveProjectRoot(configFile), DEFAULT_SEED_DIR) : resolve(raw)
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
  const { planAccounts, readAccountIndex, readPendingInvitees } = await import('./seed-accounts')
  const accountPlan = planAccounts({
    app,
    accounts: loaded.accounts,
    index: await readAccountIndex(),
    references: collectAccountReferences(plan.tables),
    actingAs,
    fallbackPassword: Bun.env.SOVRIUM_SEED_PASSWORD,
    pendingInvitees: await readPendingInvitees(),
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
  readonly print: (lines: readonly string[]) => void
}): Promise<readonly string[]> => {
  const { app, accountPlan, options } = input
  const { seedTablesOf } = await import('@/application/use-cases/seed/seed-config')
  const { buildSyntheticSession, buildSystemSession } =
    await import('@/application/use-cases/automations/build-guest-session')
  const { accountReportLines, createPlannedAccounts, invitationReportLines, readAccountIndex } =
    await import('./seed-accounts')
  const { executeSeedPlan } = await import('./seed-write')

  const { accounts, invitations } = options.dryRun
    ? { accounts: await readAccountIndex(), invitations: [] }
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
  }).catch((error: unknown) => {
    // The invitations exist and a replay will not mint them again: hand their
    // links over before the failure, or nobody ever can.
    if (invitations.length > 0) input.print(invitationReportLines(invitations))
    throw error
  })
  return [...accountReportLines(accountPlan, options.dryRun, invitations), ...rows]
}

/** The message a failed write phase prints, for the errors it knows by name. */
const describeRunFailure = async (
  error: unknown,
  print: (lines: readonly string[]) => void
): Promise<string> => {
  const { SeedWriteError } = await import('./seed-write')
  const { SeedAccountError, invitationReportLines } = await import('./seed-accounts')
  if (error instanceof SeedAccountError && error.invitations.length > 0) {
    print(invitationReportLines(error.invitations))
  }
  return error instanceof SeedWriteError || error instanceof SeedAccountError
    ? `Error: ${error.message}`
    : `Error: seeding failed: ${error instanceof Error ? error.message : String(error)}`
}

/** What a `--request <file>` may carry: the request of a hosted seed, without its app. */
const seedRequestFileSchema = Schema.Struct({
  mode: seedRunRequestSchema.fields.mode,
  tables: seedRunRequestSchema.fields.tables,
  today: seedRunRequestSchema.fields.today,
  dryRun: seedRunRequestSchema.fields.dryRun,
})

/**
 * The options with `--request <file>` read in place of the flags — how the
 * one-shot seed unit of a hosting machine passes them. A file that is missing
 * or is not a request is refused, naming it.
 */
const withRequestFile = async (
  options: SeedCommandOptions,
  path: string | undefined
): Promise<SeedCommandOptions> => {
  if (path === undefined) return options
  const text = await readFile(path, 'utf-8').catch((error: unknown) =>
    refuse(`Error: could not read the seed request ${resolve(path)}: ${String(error)}`)
  )
  const decoded = Option.flatMap(
    Option.liftThrowable(() => JSON.parse(text) as unknown)(),
    Schema.decodeUnknownOption(seedRequestFileSchema)
  )
  if (Option.isNone(decoded)) {
    return refuse(
      `Error: ${resolve(path)} is not a seed request. Expected { "mode": "if-empty" | "upsert" | "replace", "tables"?: [names], "today"?: "YYYY-MM-DD", "dryRun"?: true | false }.`
    )
  }
  const request = decoded.value
  return {
    ...options,
    mode: request.mode,
    tables: request.tables ?? [],
    dryRun: request.dryRun ?? false,
    today: request.today,
  }
}

/**
 * Leave `{ error }` in the `--report` file when the run ends on a refusal —
 * any refusal, the config's and the database's included: they all end the
 * process through `refuse`, so the `exit` handler is the one place that sees
 * every one of them.
 */
const reportRefusalsTo = (path: string | undefined): void => {
  if (path === undefined) return
  process.once('exit', (code) => {
    if (code === 0) return
    writeReportFile(path, { error: lastRefusal() ?? `sovrium seed failed (exit ${code})` })
  })
}

/**
 * The options of a run on this machine, where its `--report` goes, and how it
 * prints. A run with `--report` is a run whose output is kept — the file, and
 * on a hosting machine the unit's journal and the step's run history — so it
 * prints every invitation with its link withheld: the link is a credential.
 */
const localRun = async (given: SeedCommandOptions, argv: readonly string[]) => {
  const reportPath = getFlagPathValue(argv, '--report')
  reportRefusalsTo(reportPath)
  const kept = (lines: readonly string[]) =>
    reportPath === undefined ? lines : withholdInvitationLinks(lines)
  return {
    options: await withRequestFile(given, getFlagPathValue(argv, '--request')),
    reportPath,
    kept,
    print: (lines: readonly string[]) => report(kept(lines)),
  }
}

/**
 * Handle `sovrium seed`.
 *
 * Exits 0 when every targeted table was seeded, skipped by `if-empty`, or
 * reported by `--dry-run`; exits 1 on any refusal or write failure. The exit is
 * explicit because a database connection can outlive the last write and keep
 * the process alive, and `demo-reset.service` waits on the exit code.
 */
export const handleSeedCommand = async (given: SeedCommandOptions): Promise<void> => {
  const argv = given.argv ?? []
  if (isRemoteSeed(argv)) return handleRemoteSeed({ ...given, argv })
  const { options, reportPath, kept, print } = await localRun(given, argv)
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
    print,
  }).catch(async (error: unknown) => refuse(await describeRunFailure(error, print)))

  print(lines)
  if (reportPath !== undefined) {
    const { order } = planned.plan
    writeReportFile(
      reportPath,
      seedReportOf({ mode, dryRun: options.dryRun, order, lines: kept(lines) })
    )
  }
  process.exit(0)
}
