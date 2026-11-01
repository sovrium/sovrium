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
 * With `--baseline`, the command seeds nothing: it records the baseline an
 * `app/seed` reset returns each kept account to (`seed/baseline.ts`).
 *
 * With `--app <slug>` or `--remote`, the command seeds a HOSTED app instead
 * (`seed/remote.ts`), and that branch is taken before anything below runs: no
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

import { stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { buildSeedPlan } from '@/application/use-cases/seed/seed-plan'
import { settleAccountPlan } from '@/cli/commands/seed/account-plan'
import {
  NO_SEED_FLAGS,
  isRemoteSeed,
  seedFlags,
  withRequestFile,
  type SeedFlags,
} from '@/cli/commands/seed/flags'
import { loadSeedFiles } from '@/cli/commands/seed/load'
import { handleRemoteSeed } from '@/cli/commands/seed/remote'
import {
  report,
  seedReportOf,
  writeFailureReport,
  writeReportFile,
} from '@/cli/commands/seed/report'
import { silenced } from '@/cli/commands/seed/silent'
import { fromAsync, rethrowCliStop, withFlags } from '@/cli/runtime/run-command'
import { parseSovriumDevClock } from '@/domain/models/process-env/dev-clock'
import {
  SEED_MODES,
  parseSeedMode,
  pinRunAtToDay,
  withholdInvitationLinks,
} from '@/domain/models/seed'
import { applyDatabaseMigrations, discoverConfigFile, refuse, requireApp } from './app-prelude'
import { resolveProjectRoot } from './option-parsing'
import type { SeedPlan } from '@/application/use-cases/seed/seed-plan'
import type { AccountPlan } from '@/cli/commands/seed/accounts'
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
  /** The flags only `sovrium seed` reads: `--app`, `--remote`, `--baseline`, `--request`, `--report`. */
  readonly flags?: SeedFlags
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
export const requireSeedDir = async (
  raw: string | undefined,
  configFile: string
): Promise<string> => {
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

/**
 * The pinned development clock an undated seeded row is created at, refused in
 * production and when malformed exactly as a server refuses it at boot.
 */
const requireDevClock = (): Readonly<Date> | undefined => {
  try {
    return parseSovriumDevClock(Bun.env)
  } catch (error) {
    return refuse(`Error: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/** Settle every account question for the run, refusing before anything is written. */
export const requireAccountPlan = async (
  app: Readonly<App>,
  loaded: { readonly accounts: readonly SeedAccount[] },
  plan: SeedPlan,
  actingAs: string | undefined
) => {
  const accountPlan = await settleAccountPlan({ app, accounts: loaded.accounts, plan, actingAs })
  return accountPlan.errors.length > 0
    ? refuse(`Error: seed data was refused:\n${indent(accountPlan.errors)}`)
    : accountPlan
}

/** The run's database and its accounts: read under `--dry-run`, else created first. */
const runAccounts = async (app: Readonly<App>, accountPlan: AccountPlan, dryRun: boolean) => {
  const { createPlannedAccounts } = await import('@/cli/commands/seed/accounts')
  const { readAccountIndex } = await import('@/cli/commands/seed/account-reads')
  const { seedDatabase } = await import('@/cli/commands/seed/database')
  const database = seedDatabase()
  const settled = dryRun
    ? { accounts: await readAccountIndex(database), invitations: [] }
    : await createPlannedAccounts(database, app, accountPlan)
  return { database, ...settled }
}

/**
 * Create the accounts, then write the rows as the system or the `--as` account,
 * silently (see {@link silenced}).
 *
 * Deferred imports, for the reason the plan's are: `seed/write` drags in the
 * whole database + table layer, which no other verb needs. An eager import here
 * put that graph — and every module-load side effect in it — inside
 * `sovrium --help`. It also matters in compiled binary mode, where native
 * .node modules cannot be resolved from Bun's virtual filesystem.
 */
export const writeRun = async (input: {
  readonly app: Readonly<App>
  readonly plan: SeedPlan
  readonly accountPlan: AccountPlan
  /** Every account the files list, with the grants each carries. */
  readonly accounts: readonly SeedAccount[]
  readonly mode: SeedMode
  readonly seedDir: string
  readonly options: SeedCommandOptions
  readonly print: (lines: readonly string[]) => void
}): Promise<readonly string[]> => {
  const { accountPlan, options } = input
  const app = silenced(input.app)
  const { seedTablesOf } = await import('@/application/use-cases/seed/seed-config')
  const { buildSyntheticSession, buildSystemSession } =
    await import('@/application/use-cases/automations/build-guest-session')
  const { accountReportLines, invitationReportLines } = await import('@/cli/commands/seed/accounts')
  const { executeSeedPlan } = await import('@/cli/commands/seed/write')
  const { writeSeedGrants } = await import('@/cli/commands/seed/grants')

  const { database, accounts, invitations } = await runAccounts(app, accountPlan, options.dryRun)
  const actingId = options.as === undefined ? undefined : accounts.get(options.as.toLowerCase())
  const session = actingId === undefined ? buildSystemSession() : buildSyntheticSession(actingId)
  const context = {
    ...database,
    plan: input.plan,
    tables: seedTablesOf(app),
    seedDir: input.seedDir,
    accounts,
  }
  const grantsInput = { ...input, accountIds: accounts, context, createdBy: session.userId }
  const rows = await executeSeedPlan({
    database,
    app,
    plan: input.plan,
    tables: context.tables,
    mode: input.mode,
    seedDir: input.seedDir,
    dryRun: options.dryRun,
    session,
    accounts,
  })
    // Grants name rows by their keys, so they are written once every key has an id.
    .then(async (written) => [
      ...written.value,
      ...(options.dryRun ? [] : await writeSeedGrants({ ...grantsInput, index: written.index })),
    ])
    .catch((error: unknown) => {
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
  const { SeedWriteError } = await import('@/cli/commands/seed/write-error')
  const { SeedAccountError, invitationReportLines } = await import('@/cli/commands/seed/accounts')
  const { SeedGrantError } = await import('@/cli/commands/seed/grants')
  if (error instanceof SeedAccountError && error.invitations.length > 0) {
    print(invitationReportLines(error.invitations))
  }
  return error instanceof SeedWriteError ||
    error instanceof SeedAccountError ||
    error instanceof SeedGrantError
    ? `Error: ${error.message}`
    : `Error: seeding failed: ${error instanceof Error ? error.message : String(error)}`
}

/**
 * The options of a run on this machine, and how it prints. A run with
 * `--report` is a run whose output is kept — the file, and on a hosting machine
 * the unit's journal and the step's run history — so it prints every
 * invitation with its link withheld: the link is a credential.
 */
const localRun = async (given: SeedCommandOptions, reportPath: string | undefined) => {
  const kept = (lines: readonly string[]) =>
    reportPath === undefined ? lines : withholdInvitationLinks(lines)
  return {
    options: await withRequestFile(given, (given.flags ?? NO_SEED_FLAGS).request),
    kept,
    print: (lines: readonly string[]) => report(kept(lines)),
  }
}

/** `--baseline`: seeds nothing, and records what a reset puts back. */
const seedBaseline = async (given: SeedCommandOptions & { readonly flags: SeedFlags }) =>
  (await import('@/cli/commands/seed/baseline')).handleSeedBaseline(given)

/**
 * Handle `sovrium seed`.
 *
 * Exits 0 when every targeted table was seeded, skipped by `if-empty`, or
 * reported by `--dry-run`; exits 1 on any refusal or write failure. The exit is
 * explicit (an exit command): a database connection can outlive the last
 * write, and `demo-reset.service` waits on the exit code.
 */
const runSeedCommand = async (given: SeedCommandOptions): Promise<void> => {
  const flags = given.flags ?? NO_SEED_FLAGS
  if (flags.baseline) return seedBaseline({ ...given, flags })
  const reportPath = flags.report
  return seedHere(given, reportPath).catch((error: unknown) => {
    if (reportPath !== undefined) writeFailureReport(reportPath, error)
    throw error
  })
}

/** `sovrium seed` on this machine's database. */
const seedHere = async (
  given: SeedCommandOptions,
  reportPath: string | undefined
): Promise<void> => {
  const { options, kept, print } = await localRun(given, reportPath)
  const mode = requireMode(options.mode)
  const runAt = requireRunAt(options.today)
  const createdAt = requireDevClock()
  const configFile = options.configFile ?? (await discoverConfigFile())
  const { app, authoredTableIds } = await requireApp(configFile)
  const seedDir = await requireSeedDir(options.seedDir, configFile)

  // The default folder is read with its `seed/import/` layer; an explicit --dir alone.
  const loaded = await applyDatabaseMigrations(app, { authoredTableIds }).then(() =>
    loadSeedFiles(seedDir, options.seedDir === undefined)
  )
  if (!loaded.ok) return refuse(`Error: seed files could not be read:\n${indent(loaded.errors)}`)

  const planned = buildSeedPlan({
    app,
    files: loaded.files,
    mode,
    requestedTables: options.tables,
    runAt,
    createdAt,
  })
  if (!planned.ok) return refuse(`Error: seed data was refused:\n${indent(planned.errors)}`)

  const accountPlan = await requireAccountPlan(app, loaded, planned.plan, options.as)
  const lines = await writeRun({
    app,
    plan: planned.plan,
    accountPlan,
    accounts: loaded.accounts,
    mode,
    seedDir,
    options,
    print,
  }).catch(async (error: unknown) => {
    rethrowCliStop(error)
    return refuse(await describeRunFailure(error, print))
  })

  print(lines)
  if (reportPath !== undefined) {
    const { order } = planned.plan
    writeReportFile(
      reportPath,
      seedReportOf({ mode, dryRun: options.dryRun, order, lines: kept(lines) })
    )
  }
}

/**
 * Handle `sovrium seed`. A hosted app's run (`--app`, `--remote`) is a program
 * of its own; every other run seeds or records on this machine.
 */
export const handleSeedCommand = withFlags(seedFlags, (args) => {
  const given = {
    configFile: args.configFile,
    seedDir: args.flags.dir,
    mode: args.mode,
    tables: args.flags.tables,
    dryRun: args.dryRun ?? false,
    as: args.flags.as,
    today: args.flags.today,
    flags: args.flags,
  }
  return isRemoteSeed(args.flags) ? handleRemoteSeed(given) : fromAsync(() => runSeedCommand(given))
})
