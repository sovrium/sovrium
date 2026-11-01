/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Reset the app to its seed (`app/seed` in `reset` mode): empty every table of
 * the app, remove the accounts the seed does not list and every session,
 * return each account it keeps to its baseline and put each listed one back
 * as the seed has it, write the seed, and remove the stored files nothing
 * references once it is written.
 *
 * The caller writes the seed itself ({@link ResetAppDataInput.writeSeed}) and
 * shapes the report; this program owns the order the app's data is torn down
 * and rebuilt in, through {@link SeedResetRepository}.
 */

import { Effect } from 'effect'
import { SeedResetRepository } from '@/application/ports/repositories/seed/seed-reset-repository'
import { deriveFieldLinkTableName } from '@/domain/models/app/tables/table-derived-name-validation'
import { collectSeedTableEdges, resolveSeedTableOrder } from '@/domain/models/seed'
import {
  isKept,
  rebuildKeptOrganisation,
  recordKeptBaselines,
  resolveKeptListed,
  restoreKeptBaselines,
  type KeptListed,
} from './reset-kept-accounts'
import { seedTablesOf, type SeedTableConfig } from './seed-config'
import type {
  HostAdmin,
  RecordedBaseline,
  SeedResetError,
} from '@/application/ports/repositories/seed/seed-reset-repository'
import type { App } from '@/domain/models/app'
import type { SeedAccount } from '@/domain/models/seed'

/** What a reset is handed. */
export interface ResetAppDataInput {
  readonly app: Readonly<App>
  /** The accounts `seed/users.yaml` lists. */
  readonly listed: readonly SeedAccount[]
  /** Whether the folder has a `users.yaml`: without one, accounts and sessions stay. */
  readonly accountsFile: boolean
  /** The host's administrators, which the reset keeps ({@link readResetHostAdmins}). */
  readonly admins: readonly HostAdmin[]
  readonly dryRun: boolean
  /** Where `SOVRIUM_SEED_PASSWORD` and `AUTH_ADMIN_PASSWORD` are read from. */
  readonly env: Readonly<Record<string, string | undefined>>
  /**
   * Write the seed, as `sovrium seed --mode replace` writes it, and answer its
   * report lines. Absent when the app has no seed folder: the app is then only
   * emptied, and no stored file is removed.
   */
  readonly writeSeed?: (dryRun: boolean) => Effect.Effect<readonly string[], SeedResetError>
}

/** What a reset did, or would do: rows each app table held, the seed's lines, and the removals. */
export interface ResetAppDataResult {
  readonly held: ReadonlyMap<string, number>
  readonly lines: readonly string[]
  readonly removed: {
    readonly accounts: number
    readonly sessions: number
    readonly files: number
  }
}

/**
 * Every link table with `tableName` at either end: its own many-to-many
 * fields', and every other table's many-to-many field to it.
 */
export const linkTablesTouching = (
  tableName: string,
  tables: readonly SeedTableConfig[]
): readonly string[] => [
  ...new Set(
    tables.flatMap((table) =>
      table.fields.flatMap((field) =>
        field.type === 'relationship' &&
        field.relationType === 'many-to-many' &&
        field.relatedTable !== undefined &&
        (table.name === tableName || field.relatedTable === tableName)
          ? [
              deriveFieldLinkTableName(table, {
                name: field.name,
                relatedTable: field.relatedTable,
              }),
            ]
          : []
      )
    )
  ),
]

/** Every table of the app, children first: the order rows can be deleted in. */
const deletionOrder = (tables: readonly SeedTableConfig[]): readonly string[] => {
  const names = tables.map((table) => table.name)
  const order = resolveSeedTableOrder(names, collectSeedTableEdges(tables, new Set(names)))
  // A cycle has no safe order; the deletes then run in config order.
  return order.ok ? order.order.toReversed() : names
}

/** The host's administrators, recognised by the recorded baselines too. */
export const readResetHostAdmins: Effect.Effect<
  readonly HostAdmin[],
  SeedResetError,
  SeedResetRepository
> = Effect.gen(function* () {
  const repository = yield* SeedResetRepository
  return yield* repository.readHostAdmins(yield* repository.readBaselines)
}).pipe(Effect.withSpan('seed.read-host-admins', { attributes: { purpose: 'reset' } }))

const NO_REMOVALS = { accounts: 0, sessions: 0 } as const

/** The accounts a reset removes: neither listed nor one of the host's administrators. */
const unlistedAccounts = (kept: KeptListed, admins: readonly HostAdmin[]) =>
  Effect.gen(function* () {
    const repository = yield* SeedResetRepository
    const accounts = yield* repository.readAccounts
    return accounts.filter((account) => !isKept(account, kept, admins))
  })

/**
 * Remove every account the seed does not list — by the engine's erasure,
 * which keeps the last account able to administer the app — then every
 * session left, and answer how many of each went.
 */
const pruneAccountsAndSessions = (input: ResetAppDataInput, kept: KeptListed) =>
  Effect.gen(function* () {
    const repository = yield* SeedResetRepository
    const sessions = yield* repository.countSessions
    const unlisted = yield* unlistedAccounts(kept, input.admins)
    const erased = yield* Effect.forEach(unlisted, (account) =>
      repository.eraseAccount(account.id, input.app)
    )
    yield* repository.deleteAllSessions
    return { accounts: erased.filter(Boolean).length, sessions }
  })

/** The password a listed account is restored with: its own, else `SOVRIUM_SEED_PASSWORD`. */
const restoredPassword = (account: SeedAccount, env: ResetAppDataInput['env']) => {
  if (account.invited === true || account.unclaimed === true) return undefined
  if (account.password !== undefined && account.password !== '') return account.password
  const fallback = env.SOVRIUM_SEED_PASSWORD
  return fallback === undefined || fallback === '' ? undefined : fallback
}

/**
 * Put every listed account that exists back as the seed has it — its name, its
 * role (a host administrator stays `admin`) and, for an account that signs in
 * with a password, that password — and keep its id. Then put every host
 * administrator back to the admin role and, for the one `AUTH_ADMIN_EMAIL`
 * names when the file does not list it, to `AUTH_ADMIN_PASSWORD`.
 */
const restoreListedAndAdmins = (input: ResetAppDataInput) =>
  Effect.gen(function* () {
    const repository = yield* SeedResetRepository
    const adminIds = new Set(input.admins.map((admin) => admin.id))
    const ids = new Map((yield* repository.readAccounts).map((a) => [a.email, a.id] as const))
    yield* Effect.forEach(
      input.listed,
      (account) =>
        Effect.gen(function* () {
          const id = ids.get(account.email.toLowerCase())
          if (id === undefined) return
          const role = adminIds.has(id) ? 'admin' : account.role
          yield* repository.updateAccountProfile(id, { name: account.name, role })
          const password = restoredPassword(account, input.env)
          if (password !== undefined) yield* repository.setCredentialPassword(id, password)
        }),
      { discard: true }
    )
    const listedEmails = new Set(input.listed.map((account) => account.email.toLowerCase()))
    const adminPassword = input.env.AUTH_ADMIN_PASSWORD?.trim() ?? ''
    yield* Effect.forEach(
      input.admins,
      (admin) =>
        Effect.gen(function* () {
          yield* repository.setAdminRole(admin.id)
          if (!admin.byEmail || adminPassword === '' || listedEmails.has(admin.email)) return
          yield* repository.setCredentialPassword(admin.id, adminPassword)
        }),
      { discard: true }
    )
  })

/**
 * Return every account the reset keeps to its baseline — or, with none, to its
 * password and Cloud link — then to the name, role and password the file or
 * the host gives it; remove the OAuth resources no kept client links to; and
 * rebuild the organisation. Answers the baselines that applied, by account id.
 */
const restoreKeptAccounts = (
  input: ResetAppDataInput,
  baselines: ReadonlyMap<string, RecordedBaseline>,
  kept: KeptListed
) =>
  Effect.gen(function* () {
    const repository = yield* SeedResetRepository
    yield* repository.clearKeptSignInMaterial
    const applied = yield* restoreKeptBaselines(baselines, kept, input.admins)
    yield* restoreListedAndAdmins(input)
    yield* repository.clearUnlinkedOAuthResources
    yield* rebuildKeptOrganisation(input.app, input.listed, input.admins)
    return applied
  })

/** A dry run: what the reset would do, with nothing touched. */
const planReset = (input: ResetAppDataInput) =>
  Effect.gen(function* () {
    const repository = yield* SeedResetRepository
    const names = seedTablesOf(input.app).map((table) => table.name)
    const counts = yield* Effect.forEach(names, (name) => repository.countAppTableRows(name))
    const held = new Map(names.map((name, index) => [name, counts[index] ?? 0] as const))
    const removals = input.accountsFile
      ? yield* Effect.gen(function* () {
          const kept = yield* resolveKeptListed(input.listed, yield* repository.readBaselines)
          const sessions = yield* repository.countSessions
          const unlisted = yield* unlistedAccounts(kept, input.admins)
          return { accounts: unlisted.length, sessions }
        })
      : NO_REMOVALS
    const lines = input.writeSeed === undefined ? [] : yield* input.writeSeed(true)
    return { held, lines, removed: { ...removals, files: 0 } }
  })

/**
 * Bring the app back to its seed, in order: empty every table; remove the
 * accounts `users.yaml` does not list and every session; return each kept
 * account to its baseline, then to the name, role and password the file or the
 * host gives it; seed; record the kept accounts' baselines; then remove the
 * files nothing references. An app with no accounts file keeps its accounts
 * and sessions, and one with no seed folder is only emptied. A dry run reads
 * what each step would remove and writes nothing.
 */
export const resetAppData = (
  input: ResetAppDataInput
): Effect.Effect<ResetAppDataResult, SeedResetError, SeedResetRepository> =>
  Effect.gen(function* () {
    if (input.dryRun) return yield* planReset(input)
    const repository = yield* SeedResetRepository
    const tables = seedTablesOf(input.app)
    const order = deletionOrder(tables)
    const counts = yield* Effect.forEach(order, (name) =>
      repository.emptyAppTable(name, linkTablesTouching(name, tables))
    )
    const held = new Map(order.map((name, index) => [name, counts[index] ?? 0] as const))
    yield* repository.clearRecordScopedRows(tables.map((table) => table.name))
    const baselines = yield* repository.readBaselines
    const kept = yield* resolveKeptListed(input.listed, baselines)
    const removals = input.accountsFile ? yield* pruneAccountsAndSessions(input, kept) : NO_REMOVALS
    const applied = input.accountsFile
      ? yield* restoreKeptAccounts(input, baselines, kept)
      : new Map<string, RecordedBaseline>()
    const lines = input.writeSeed === undefined ? [] : yield* input.writeSeed(false)
    if (input.accountsFile) yield* recordKeptBaselines(input.listed, input.admins, applied)
    const files = input.writeSeed === undefined ? 0 : yield* repository.removeUnreferencedFiles
    return { held, lines, removed: { ...removals, files } }
  }).pipe(
    Effect.withSpan('seed.reset-app-data', {
      attributes: { dryRun: input.dryRun, accountsFile: input.accountsFile },
    })
  )
