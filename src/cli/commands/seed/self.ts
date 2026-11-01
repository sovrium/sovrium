/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The seeder an `app/seed` step runs, inside the server `sovrium start`
 * started: the one `sovrium seed` runs — the same files, plan, accounts and
 * write path, with the same refusals in the same words — on the `seed/` folder
 * beside the config file the server was started with. Like the command, it is
 * silent: no activity-log entry, record automation or table webhook for a row
 * it writes.
 *
 * Two things differ from the command, each because the run happens inside a
 * live server rather than in a process of its own:
 *
 * - **Nothing exits.** A refusal is thrown as an `Error` carrying the seeder's
 *   message, which the step fails with; `sovrium seed` would end the process.
 * - **`reset`.** Checked whole before anything is touched — every seed file,
 *   and the password of every account `users.yaml` lists, existing ones
 *   included, since the reset restores it — then the app is emptied and
 *   brought back to its seed by the reset use-case (`reset-app-data.ts`), the
 *   report shaped here.
 */

import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { Effect, Layer } from 'effect'
import { SeedResetError } from '@/application/ports/repositories/seed/seed-reset-repository'
import { readResetHostAdmins, resetAppData } from '@/application/use-cases/seed/reset-app-data'
import { seedTablesOf } from '@/application/use-cases/seed/seed-config'
import { buildSeedPlan } from '@/application/use-cases/seed/seed-plan'
import { resolveProjectRoot } from '@/cli/commands/option-parsing'
import { writeRun } from '@/cli/commands/seed'
import { resolvePasswordPolicy } from '@/domain/models/app/auth/password-policy'
import { parseSovriumDevClock } from '@/domain/models/process-env/dev-clock'
import { pinRunAtToDay, withholdInvitationLinks } from '@/domain/models/seed'
import { seedPasswordRefusals } from '@/domain/models/seed/seed-password-policy'
import { DatabaseUnownedLive } from '@/infrastructure/database/drizzle/layer'
import { SeedResetRepositoryLive } from '@/infrastructure/database/repositories/seed/seed-reset-repository-live'
import { settleAccountPlan } from './account-plan'
import { SeedStorageLive } from './database'
import { loadSeedFiles } from './load'
import { seedReportOf } from './report'
import { silenced } from './silent'
import type { HostAdmin } from '@/application/ports/repositories/seed/seed-reset-repository'
import type {
  AppSelfSeedRequest,
  AppSelfSeedRunner,
} from '@/application/ports/services/app-self-seeder'
import type { ResetAppDataResult } from '@/application/use-cases/seed/reset-app-data'
import type { SeedPlan } from '@/application/use-cases/seed/seed-plan'
import type { AppSeedReport } from '@/domain/models/api/automations/steps/app-seed'
import type { App } from '@/domain/models/app'
import type { SeedAccount, SeedMode } from '@/domain/models/seed'

const indent = (lines: readonly string[]): string => lines.map((line) => `  ${line}`).join('\n')

/** A refusal: the step fails with exactly this message. */
const refusal = (message: string): never => {
  throw new Error(message)
}

/** The instant `{{today…}}` renders against: the step's `today`, else `SOVRIUM_SEED_TODAY`, else now. */
const runAtOf = (today: string | undefined): Readonly<Date> => {
  const clock = new Date()
  const [raw, source] =
    today !== undefined ? [today, 'today'] : [Bun.env.SOVRIUM_SEED_TODAY, 'SOVRIUM_SEED_TODAY']
  if (raw === undefined || raw === '') return clock
  return (
    pinRunAtToDay(raw, clock) ??
    refusal(`${source} "${raw}" is not a calendar day. Expected YYYY-MM-DD, e.g. 2026-09-24.`)
  )
}

/** The seed folder beside the config, when there is one. */
const seedDirOf = async (configPath: string | undefined): Promise<string | undefined> => {
  if (configPath === undefined || configPath === '') return undefined
  const dir = join(resolveProjectRoot(configPath), 'seed')
  return (await stat(dir).catch(() => undefined))?.isDirectory() === true ? dir : undefined
}

/** What the folder holds: nothing at all when there is no folder. */
const loadFolder = async (seedDir: string | undefined) => {
  if (seedDir === undefined) {
    return { files: [], accounts: [] as readonly SeedAccount[], accountsFile: false }
  }
  const loaded = await loadSeedFiles(seedDir, true)
  return loaded.ok ? loaded : refusal(`seed files could not be read:\n${indent(loaded.errors)}`)
}

/**
 * Every account question, settled before anything is written. Under a reset
 * that prunes accounts, every listed account is judged as if it did not exist
 * yet — the reset restores its password — and an `@user:` value may name only
 * a listed account or one of the host's administrators, since every other one
 * is about to go.
 */
const requireAccounts = async (input: {
  readonly app: Readonly<App>
  readonly accounts: readonly SeedAccount[]
  readonly plan: SeedPlan
  /** Under a reset that prunes: the host's administrators, the only accounts it keeps unlisted. */
  readonly kept?: readonly HostAdmin[]
}) => {
  const planned = await settleAccountPlan({
    app: input.app,
    accounts: input.accounts,
    plan: input.plan,
    actingAs: undefined,
    ...(input.kept === undefined
      ? {}
      : {
          index: new Map(input.kept.map((admin) => [admin.email, admin.id])),
          pendingInvitees: new Set<string>(),
        }),
  })
  const errors = [
    ...planned.errors,
    ...seedPasswordRefusals(
      passwordsSet(planned.toCreate, input.accounts, input.kept),
      resolvePasswordPolicy(input.app.auth)
    ),
  ]
  return errors.length > 0 ? refusal(`seed data was refused:\n${indent(errors)}`) : planned
}

/** A listed account's own password, else `SOVRIUM_SEED_PASSWORD`; none for invited or unclaimed. */
const seedPasswordOf = (account: SeedAccount): string | undefined => {
  if (account.invited === true || account.unclaimed === true) return undefined
  const own = account.password ?? ''
  const fallback = Bun.env.SOVRIUM_SEED_PASSWORD ?? ''
  if (own !== '') return own
  return fallback === '' ? undefined : fallback
}

/**
 * Every password the run will set, so the app's policy judges them before
 * anything is written: the accounts it creates and, under a reset, each host
 * administrator's — from `seed/users.yaml` when it lists one, else
 * `AUTH_ADMIN_PASSWORD`.
 */
const passwordsSet = (
  created: readonly { readonly email: string; readonly password: string }[],
  listed: readonly SeedAccount[],
  kept: readonly HostAdmin[] | undefined
): readonly { readonly email: string; readonly password: string }[] => {
  const adminPassword = Bun.env.AUTH_ADMIN_PASSWORD?.trim() ?? ''
  const admins = (kept ?? []).flatMap((admin) => {
    const entry = listed.find((account) => account.email.toLowerCase() === admin.email)
    const password =
      entry === undefined ? (admin.byEmail ? adminPassword : '') : (seedPasswordOf(entry) ?? '')
    return password === '' ? [] : [{ email: admin.email, password }]
  })
  return [...created.map(({ email, password }) => ({ email, password })), ...admins]
}

/** Write the plan as `sovrium seed` does, and answer its report lines. */
const seedPlan = async (input: {
  readonly app: App
  readonly plan: SeedPlan
  readonly accounts: readonly SeedAccount[]
  readonly mode: SeedMode
  readonly seedDir: string
  readonly dryRun: boolean
}): Promise<readonly string[]> => {
  const accountPlan = await requireAccounts(input)
  return writeRun({
    ...input,
    accountPlan,
    options: {
      configFile: undefined,
      seedDir: input.seedDir,
      mode: input.mode,
      tables: [],
      dryRun: input.dryRun,
    },
    print: () => undefined,
  }).catch((error: unknown) => refusal(error instanceof Error ? error.message : String(error)))
}

/** The plan, refused in the seeder's words. Under `reset`, the plan `replace` would write. */
const planOf = (
  app: Readonly<App>,
  folder: Awaited<ReturnType<typeof loadFolder>>,
  request: AppSelfSeedRequest
): SeedPlan => {
  const planned = buildSeedPlan({
    app,
    files: folder.files,
    mode: request.mode === 'reset' ? 'replace' : request.mode,
    requestedTables: request.tables ?? [],
    runAt: runAtOf(request.today),
    createdAt: parseSovriumDevClock(Bun.env),
  })
  return planned.ok ? planned.plan : refusal(`seed data was refused:\n${indent(planned.errors)}`)
}

/** A self-seed in `if-empty`, `upsert` or `replace`: `sovrium seed`, silent. */
const seedInPlace = async (
  app: Readonly<App>,
  seedDir: string | undefined,
  request: AppSelfSeedRequest
): Promise<AppSeedReport> => {
  if (seedDir === undefined) {
    return refusal(
      'seed directory not found: create a seed/ folder beside the config file the server was started with.'
    )
  }
  const folder = await loadFolder(seedDir)
  const plan = planOf(app, folder, request)
  const lines = await seedPlan({
    app: silenced(app),
    plan,
    accounts: folder.accounts,
    mode: request.mode as SeedMode,
    seedDir,
    dryRun: request.dryRun,
  })
  const kept = withholdInvitationLinks(lines)
  return seedReportOf({
    mode: request.mode as SeedMode,
    dryRun: request.dryRun,
    order: plan.order,
    lines: kept,
  })
}

/** The reset's repository, on the seed's database and the app's storage. */
const SeedResetLive = Layer.provide(
  SeedResetRepositoryLive,
  Layer.merge(SeedStorageLive, DatabaseUnownedLive)
)

/** A step of the reset written as a Promise, failing with the words it was refused in. */
const resetStep = <A>(run: () => Promise<A>): Effect.Effect<A, SeedResetError> =>
  Effect.tryPromise({
    try: run,
    catch: (cause) =>
      new SeedResetError({
        message: cause instanceof Error ? cause.message : String(cause),
        cause,
      }),
  })

/** The report: one entry per table of the app — seeded ones first, in seed order — and the removals. */
const resetReportOf = (
  app: Readonly<App>,
  plan: SeedPlan,
  dryRun: boolean,
  { held, lines, removed }: ResetAppDataResult
): AppSeedReport => {
  const seeded = seedReportOf({ mode: 'replace', dryRun, order: plan.order, lines })
  const emptied = seedTablesOf(app)
    .map((table) => table.name)
    .filter((name) => !plan.order.includes(name))
  const verb = dryRun ? '[dry-run] ' : ''
  return {
    mode: 'reset',
    dryRun,
    tables: [
      ...seeded.tables.map((result) => ({ ...result, deleted: held.get(result.table) ?? 0 })),
      ...emptied.map((table) => ({
        table,
        outcome: 'emptied' as const,
        created: 0,
        updated: 0,
        deleted: held.get(table) ?? 0,
      })),
    ],
    removed,
    lines: withholdInvitationLinks([
      ...lines,
      ...emptied.map((table) => `${verb}${table}: emptied (${held.get(table) ?? 0} rows deleted)`),
      `${verb}removed: accounts ${removed.accounts}, sessions ${removed.sessions}, files ${removed.files}`,
    ]),
  }
}

/**
 * A self-seed in `reset`: every account question settled against the host's
 * administrators — the only accounts a reset that prunes keeps unlisted —
 * then the app brought back to its seed, the seed written as `replace` would.
 */
const resetToSeed = (
  request: AppSelfSeedRequest,
  seedDir: string | undefined,
  folder: Awaited<ReturnType<typeof loadFolder>>,
  plan: SeedPlan
) =>
  Effect.gen(function* () {
    const { app, dryRun } = request
    const admins = yield* readResetHostAdmins
    // Accounts are pruned only when the folder lists them; without, they stay.
    const kept = folder.accountsFile ? admins : undefined
    yield* resetStep(() => requireAccounts({ app, accounts: folder.accounts, plan, kept }))
    const silent = silenced(app)
    const { accounts } = folder
    const result = yield* resetAppData({
      app,
      listed: accounts,
      accountsFile: folder.accountsFile,
      admins,
      dryRun,
      env: Bun.env,
      ...(seedDir === undefined
        ? {}
        : {
            writeSeed: (asDryRun: boolean) =>
              resetStep(() =>
                seedPlan({
                  app: silent,
                  plan,
                  accounts,
                  mode: 'replace',
                  seedDir,
                  dryRun: asDryRun,
                })
              ),
          }),
    })
    return resetReportOf(app, plan, dryRun, result)
  })

/** Build the runner for the server started from `configPath`. */
export const createAppSelfSeedRunner =
  (configPath: string | undefined): AppSelfSeedRunner =>
  async (request) => {
    const seedDir = await seedDirOf(configPath)
    if (request.mode !== 'reset') return seedInPlace(request.app, seedDir, request)
    const folder = await loadFolder(seedDir)
    const plan = planOf(request.app, folder, request)
    // The runner is the boundary the server hands the step to: the reset runs here, once.
    return Effect.runPromise(
      Effect.provide(resetToSeed(request, seedDir, folder, plan), SeedResetLive)
    ).catch((error: unknown) => refusal(error instanceof Error ? error.message : String(error)))
  }
