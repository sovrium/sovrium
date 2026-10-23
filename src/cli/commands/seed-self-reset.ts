/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What only an `app/seed` reset does, on top of `sovrium seed --mode replace`:
 * empty every table of the app, remove the accounts the seed does not list and
 * every session, put each listed account back as the seed has it, and remove
 * the stored files nothing references once the seed is written.
 *
 * Every write here is a raw statement, never a record program, for the reason
 * `--mode replace` deletes with raw SQL (`seed-write.ts`): a reset is one
 * operation on the app's own state, not a sequence of business events, so no
 * row it deletes reaches a record automation, a table webhook or the activity
 * log. The one exception is an unlisted account, removed by the engine's
 * account erasure, which writes its own audit entry (see
 * {@link pruneAccountsAndSessions}).
 */

import { sql } from 'drizzle-orm'
import { seedTablesOf } from '@/application/use-cases/seed/seed-config'
import {
  collectSeedTableEdges,
  resolveSeedTableOrder,
  withholdInvitationLinks,
} from '@/domain/models/seed'
import { db } from '@/infrastructure/database'
import { purgeAccount } from '@/infrastructure/database/account-purge'
import { resolvePurgeTableAuthorship } from '@/infrastructure/database/account-purge-authorship'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import { authTableRef, authUserTableRef } from '@/infrastructure/database/sql/dialect-sql'
import { seedReportOf } from './seed-report'
import { restoreHostAdmins, setCredentialPassword, type HostAdmin } from './seed-self-admins'
import {
  clearKeptSignInMaterial,
  clearRecordScopedRows,
  removeUnreferencedFiles,
} from './seed-self-clear'
import { clearJunctions, countRows, deleteAllRows } from './seed-write'
import type { SeedPlan } from '@/application/use-cases/seed/seed-plan'
import type { AppSeedReport } from '@/domain/models/api/automations/steps/app-seed'
import type { App } from '@/domain/models/app'
import type { SeedAccount, SeedMode } from '@/domain/models/seed'

const describe = (error: unknown) => (error instanceof Error ? error.message : String(error))

/** Every table of the app, children first: the order rows can be deleted in. */
const deletionOrder = (app: Readonly<App>): readonly string[] => {
  const tables = seedTablesOf(app)
  const names = tables.map((table) => table.name)
  const order = resolveSeedTableOrder(names, collectSeedTableEdges(tables, new Set(names)))
  // A cycle has no safe order; the raw deletes below then run in config order.
  return order.ok ? order.order.toReversed() : names
}

/** Empty every table of the app, links first, and answer how many rows each held. */
export const emptyAppTables = (app: Readonly<App>): Promise<ReadonlyMap<string, number>> => {
  const tables = seedTablesOf(app)
  return deletionOrder(app).reduce<Promise<ReadonlyMap<string, number>>>(
    (previous, name) =>
      previous.then(async (counted) => {
        const held = await countRows(name)
        await clearJunctions(
          name,
          tables.find((table) => table.name === name)
        )
        await deleteAllRows(name).catch((error: unknown) => {
          throw new Error(`reset could not empty the table "${name}": ${describe(error)}`)
        })
        return new Map([...counted, [name, held]])
      }),
    Promise.resolve(new Map())
  )
}

/** Every account, with its id and lower-cased email. */
const readAccounts = async (): Promise<
  readonly { readonly id: string; readonly email: string }[]
> =>
  (await executeRaw(db, sql`SELECT id, email FROM ${authUserTableRef()}`)).flatMap((row) =>
    typeof row.email === 'string' ? [{ id: String(row.id), email: row.email.toLowerCase() }] : []
  )

/** The accounts a reset removes: neither listed nor one of the host's administrators. */
const unlistedAccounts = async (keep: ReadonlySet<string>, admins: readonly HostAdmin[]) => {
  const kept = new Set(admins.map((admin) => admin.id))
  return (await readAccounts()).filter(
    (account) => !keep.has(account.email) && !kept.has(account.id)
  )
}

/** How many sessions there are. */
const countSessions = async (): Promise<number> =>
  Number(
    (await executeRaw(db, sql`SELECT COUNT(*) AS n FROM ${authTableRef('session')}`))[0]?.n ?? 0
  )

/**
 * Remove every account the seed does not list, then every session left, and
 * answer how many of each went.
 *
 * Each account is removed by the engine's own erasure (`purgeAccount`), the
 * one behind the scheduled purge and the account-deletion link, rather than by
 * a delete of its user row: a demo visitor's account is personal data, and
 * the user row's cascades leave some of it behind — an OAuth access token
 * minted without a refresh token (whose owner column is only nulled, so it
 * still authenticates), pending verification tokens, the operator-search
 * entry holding the address, the AI activity feed, form drafts. The erasure's
 * last-admin rail also holds here: an unlisted account that is the last one
 * able to administer the app is kept, as a host administrator is. The erasure
 * closes a removed account's realtime connections; those of a kept account,
 * whose sessions the raw delete below ends unseen by any session hook, close
 * at the realtime layer's next liveness sweep.
 */
export const pruneAccountsAndSessions = async (
  app: Readonly<App>,
  listed: readonly SeedAccount[],
  admins: readonly HostAdmin[]
): Promise<{ readonly accounts: number; readonly sessions: number }> => {
  const keep = new Set(listed.map((account) => account.email.toLowerCase()))
  const sessions = await countSessions()
  const unlisted = await unlistedAccounts(keep, admins)
  const appTables = (app.tables ?? []).map((table) =>
    resolvePurgeTableAuthorship(app.tables, table.name)
  )
  const erased = await unlisted.reduce<Promise<number>>(
    (previous, account) =>
      previous.then(async (count) => {
        const outcome = await purgeAccount(account.id, appTables, app).catch((error: unknown) => {
          throw new Error(`reset could not remove the account ${account.id}: ${describe(error)}`)
        })
        return outcome._tag === 'Erased' ? count + 1 : count
      }),
    Promise.resolve(0)
  )
  await executeRaw(db, sql`DELETE FROM ${authTableRef('session')}`)
  return { accounts: erased, sessions }
}

/**
 * Put every listed account that exists back as the seed has it — its name, its
 * role and, for an account that signs in with a password, that password — and
 * keep its id, so every row and reference naming it still does.
 */
export const restoreListedAccounts = async (
  listed: readonly (SeedAccount & { readonly password?: string | undefined })[],
  admins: readonly HostAdmin[]
): Promise<void> => {
  const adminIds = new Set(admins.map((admin) => admin.id))
  const ids = new Map((await readAccounts()).map((account) => [account.email, account.id]))
  await listed.reduce<Promise<void>>(
    (previous, account) =>
      previous.then(async () => {
        const id = ids.get(account.email.toLowerCase())
        if (id === undefined) return
        await executeRaw(
          db,
          sql`UPDATE ${authUserTableRef()} SET name = ${account.name},
              role = ${adminIds.has(id) ? 'admin' : account.role} WHERE id = ${id}`
        )
        if (account.password === undefined) return
        await setCredentialPassword(id, account.password)
      }),
    Promise.resolve()
  )
}

/** The password a listed account is restored with: its own, else `SOVRIUM_SEED_PASSWORD`. */
const restoredPassword = (account: SeedAccount): string | undefined => {
  if (account.invited === true || account.unclaimed === true) return undefined
  if (account.password !== undefined && account.password !== '') return account.password
  const fallback = Bun.env.SOVRIUM_SEED_PASSWORD
  return fallback === undefined || fallback === '' ? undefined : fallback
}

/** How many accounts and sessions a reset would remove, read without removing any. */
const countRemovals = async (
  listed: readonly SeedAccount[],
  admins: readonly HostAdmin[]
): Promise<{ readonly accounts: number; readonly sessions: number }> => {
  const keep = new Set(listed.map((account) => account.email.toLowerCase()))
  const sessions = await countSessions()
  const unlisted = await unlistedAccounts(keep, admins)
  return { accounts: unlisted.length, sessions }
}

/** What the reset was handed: the folder as read, the plan as checked, and how to seed. */
export interface ResetInput {
  readonly app: Readonly<App>
  /** The app with its activity logs off, which the seed is written through. */
  readonly silent: App
  readonly plan: SeedPlan
  readonly folder: {
    readonly accounts: readonly SeedAccount[]
    readonly accountsFile: boolean
  }
  readonly seedDir: string | undefined
  readonly dryRun: boolean
  /** The host's administrators, which the reset keeps. */
  readonly admins: readonly HostAdmin[]
  readonly seed: (input: {
    readonly app: App
    readonly plan: SeedPlan
    readonly accounts: readonly SeedAccount[]
    readonly mode: SeedMode
    readonly seedDir: string
    readonly dryRun: boolean
  }) => Promise<readonly string[]>
}

/** The report: one entry per table of the app — seeded ones first, in seed order — and the removals. */
const reportOf = (
  input: ResetInput,
  held: ReadonlyMap<string, number>,
  lines: readonly string[],
  removed: { readonly accounts: number; readonly sessions: number; readonly files: number }
): AppSeedReport => {
  const seeded = seedReportOf({
    mode: 'replace',
    dryRun: input.dryRun,
    order: input.plan.order,
    lines,
  })
  const emptied = seedTablesOf(input.app)
    .map((table) => table.name)
    .filter((name) => !input.plan.order.includes(name))
  const verb = input.dryRun ? '[dry-run] ' : ''
  return {
    mode: 'reset',
    dryRun: input.dryRun,
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

/** A dry run: what the reset would do, with nothing touched. */
const planReset = async (input: ResetInput): Promise<AppSeedReport> => {
  const names = seedTablesOf(input.app).map((table) => table.name)
  const held = new Map(await Promise.all(names.map(async (n) => [n, await countRows(n)] as const)))
  const removals = input.folder.accountsFile
    ? await countRemovals(input.folder.accounts, input.admins)
    : { accounts: 0, sessions: 0 }
  const lines =
    input.seedDir === undefined
      ? []
      : await input.seed({
          ...input,
          app: input.silent,
          accounts: input.folder.accounts,
          mode: 'replace',
          seedDir: input.seedDir,
        })
  return reportOf(input, held, lines, { ...removals, files: 0 })
}

/**
 * Bring the app back to its seed, in order: empty every table; remove the
 * accounts `users.yaml` does not list and every session; restore each listed
 * account; seed; then remove the files nothing references. An app with no
 * accounts file keeps its accounts and sessions, and one with no seed folder is
 * only emptied.
 */
export const resetApp = async (input: ResetInput): Promise<AppSeedReport> => {
  if (input.dryRun) return planReset(input)
  const held = await emptyAppTables(input.app)
  await clearRecordScopedRows(input.app)
  const { accountsFile, accounts } = input.folder
  const removals = accountsFile
    ? await pruneAccountsAndSessions(input.app, accounts, input.admins)
    : { accounts: 0, sessions: 0 }
  if (accountsFile) {
    await clearKeptSignInMaterial()
    await restoreListedAccounts(
      accounts.map((account) => ({ ...account, password: restoredPassword(account) })),
      input.admins
    )
    await restoreHostAdmins(input.admins, accounts)
  }
  if (input.seedDir === undefined) return reportOf(input, held, [], { ...removals, files: 0 })
  const lines = await input.seed({
    app: input.silent,
    plan: input.plan,
    accounts,
    mode: 'replace',
    seedDir: input.seedDir,
    dryRun: false,
  })
  const files = await removeUnreferencedFiles()
  return reportOf(input, held, lines, { ...removals, files })
}
