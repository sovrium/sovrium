/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Which accounts a reset of the app to its seed keeps, and returning them to
 * their baselines.
 *
 * A reset keeps the accounts `seed/users.yaml` lists and the host's
 * administrators. A listed account is found by its address — or, when a
 * baseline was recorded with an address the file still lists, by the id that
 * baseline names, so an account whose email a visitor changed is still the
 * listed one and is put back rather than erased.
 */

import { Effect } from 'effect'
import { SeedResetRepository } from '@/application/ports/repositories/seed/seed-reset-repository'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles/role'
import type {
  HostAdmin,
  RecordedBaseline,
  ResetAccount,
  SeedResetError,
} from '@/application/ports/repositories/seed/seed-reset-repository'
import type { App } from '@/domain/models/app'
import type { SeedAccount } from '@/domain/models/seed'

/** The listed accounts a reset keeps: by baseline id where one names a listed address, else by address. */
export interface KeptListed {
  /** Accounts kept by the id their baseline recorded. */
  readonly ids: ReadonlySet<string>
  /** Listed addresses kept by address: those no recognised baseline answers for. */
  readonly emails: ReadonlySet<string>
}

/** Resolve the listed accounts against the recorded baselines and the accounts that exist. */
export const resolveKeptListed = (
  listed: readonly SeedAccount[],
  baselines: ReadonlyMap<string, RecordedBaseline>
): Effect.Effect<KeptListed, SeedResetError, SeedResetRepository> =>
  Effect.gen(function* () {
    const repository = yield* SeedResetRepository
    const addresses = new Set(listed.map((account) => account.email.toLowerCase()))
    const existing = new Set((yield* repository.readAccounts).map((account) => account.id))
    const recognised = [...baselines.values()].filter(
      (baseline) => addresses.has(baseline.email) && existing.has(baseline.userId)
    )
    const answered = new Set(recognised.map((baseline) => baseline.email))
    return {
      ids: new Set(recognised.map((baseline) => baseline.userId)),
      emails: new Set([...addresses].filter((email) => !answered.has(email))),
    }
  }).pipe(Effect.withSpan('seed.resolve-kept-listed', { attributes: { listed: listed.length } }))

/** Whether an account is one the reset keeps. */
export const isKept = (
  account: ResetAccount,
  kept: KeptListed,
  admins: readonly HostAdmin[]
): boolean =>
  kept.emails.has(account.email) ||
  kept.ids.has(account.id) ||
  admins.some((admin) => admin.id === account.id)

/**
 * The baselines that apply to the kept accounts: the listed ones recognised by
 * their baseline, and the host's administrators — the one `AUTH_ADMIN_EMAIL`
 * names only when its baseline was recorded with that address.
 */
const applyingBaselines = (
  baselines: ReadonlyMap<string, RecordedBaseline>,
  kept: KeptListed,
  admins: readonly HostAdmin[]
): readonly RecordedBaseline[] =>
  [...baselines.values()].filter((baseline) => {
    if (kept.ids.has(baseline.userId)) return true
    const admin = admins.find((candidate) => candidate.id === baseline.userId)
    // `AUTH_ADMIN_EMAIL` changed on purpose: the baseline recorded under the old address is not it.
    return admin !== undefined && (!admin.byEmail || admin.email === baseline.email)
  })

/**
 * Return each kept account with a baseline to it, and answer those baselines,
 * by account id. One with no baseline that applies keeps only what clearing
 * its sign-in material left it — its password and, for the platform
 * administrator, its Cloud link — and gets one at the end of the reset.
 * Called with none applying, the restore still removes every third-party
 * connection token no copy holds.
 */
export const restoreKeptBaselines = (
  baselines: ReadonlyMap<string, RecordedBaseline>,
  kept: KeptListed,
  admins: readonly HostAdmin[]
): Effect.Effect<ReadonlyMap<string, RecordedBaseline>, SeedResetError, SeedResetRepository> =>
  Effect.gen(function* () {
    const repository = yield* SeedResetRepository
    const applied = applyingBaselines(baselines, kept, admins)
    yield* repository.restoreBaselines(applied)
    return new Map(applied.map((baseline) => [baseline.userId, baseline] as const))
  }).pipe(
    Effect.withSpan('seed.restore-kept-baselines', { attributes: { baselines: baselines.size } })
  )

/**
 * Record the baseline of every account the reset kept, as it ends — the listed
 * accounts, the seed has just created included, and the host's administrators.
 *
 * Nothing is read back for an account `applied` restored: its baseline stays
 * the copy it was just returned to. Every other account's copy is read now and
 * cut to its first baseline, under the address it was kept for. Either way,
 * what anyone signed in to the app does while the seed is being written — a
 * key created, a second factor turned on, an address changed — never becomes
 * what the next reset puts back.
 */
export const recordKeptBaselines = (
  listed: readonly SeedAccount[],
  admins: readonly HostAdmin[],
  applied: ReadonlyMap<string, RecordedBaseline>
): Effect.Effect<readonly RecordedBaseline[], SeedResetError, SeedResetRepository> =>
  Effect.gen(function* () {
    const repository = yield* SeedResetRepository
    const addresses = new Set(listed.map((account) => account.email.toLowerCase()))
    const listedFor = new Map(
      (yield* repository.readAccounts)
        .filter((account) => addresses.has(account.email))
        .map((account) => [account.id, account.email] as const)
    )
    const keptFor = new Map<string, string | undefined>([
      ...listedFor,
      ...admins.map(
        (admin) => [admin.id, admin.byEmail ? admin.email : listedFor.get(admin.id)] as const
      ),
    ])
    const entries = yield* Effect.forEach(
      [...new Set([...applied.keys(), ...keptFor.keys()])],
      (userId) => {
        const restored = applied.get(userId)
        return restored === undefined
          ? repository.captureFirstBaseline(userId, keptFor.get(userId))
          : Effect.succeed(restored)
      }
    )
    return yield* repository.recordBaselines(entries.filter((entry) => entry !== undefined))
  }).pipe(Effect.withSpan('seed.record-kept-baselines', { attributes: { listed: listed.length } }))

/**
 * The organisation role each kept account takes, by the role it holds now
 * (restored before the organisation is rebuilt): `owner` for an account whose
 * role is the app's administrator role or one equivalent to it, `member` for
 * every other — the membership a seed run gives it.
 */
const seededRoles = (
  app: Readonly<App>,
  roles: ReadonlyMap<string, string | undefined>
): ReadonlyMap<string, 'owner' | 'member'> =>
  new Map(
    [...roles].map(([id, role]) => [
      id,
      role !== undefined && isAdminEquivalent(role, app) ? 'owner' : 'member',
    ])
  )

/**
 * Rebuild the organisation from the config and the seed: no invitation, the
 * declared groups' teams with no member, the host administrators' memberships
 * kept and each listed account that exists a member as a seed run makes it.
 * An account the seed creates afterwards is made a member by the engine as it
 * is created. Nothing to do for an app with no organisation tables.
 */
export const rebuildKeptOrganisation = (
  app: Readonly<App>,
  listed: readonly SeedAccount[],
  admins: readonly HostAdmin[]
): Effect.Effect<void, SeedResetError, SeedResetRepository> =>
  Effect.gen(function* () {
    const repository = yield* SeedResetRepository
    if (!(yield* repository.organisationExists)) return
    const ids = new Map(
      (yield* repository.readAccounts).map((account) => [account.email, account.id])
    )
    const members = [
      ...new Set([
        ...admins.map((admin) => admin.id),
        ...listed.flatMap((account) => {
          const id = ids.get(account.email.toLowerCase())
          return id === undefined ? [] : [id]
        }),
      ]),
    ]
    yield* repository.rebuildOrganisation({
      appName: app.name,
      groups: (app.auth?.groups ?? []).map((group) => group.name),
      roles: seededRoles(app, yield* repository.readUserRoles(members)),
      adminIds: admins.map((admin) => admin.id),
    })
  }).pipe(Effect.withSpan('seed.rebuild-organisation', { attributes: { listed: listed.length } }))

/** What a baseline holds, named for the operator — never a secret, never a key. */
export const describeBaseline = (baseline: RecordedBaseline): string => {
  const { rows } = baseline.snapshot
  const count = (key: string) => (rows[key] ?? []).length
  const providers = (rows.account ?? []).map((row) => String(row.provider_id))
  const held = [
    providers.includes('credential') ? 'password' : undefined,
    count('two_factor') > 0 ? 'two-step verification' : undefined,
    count('passkey') > 0 ? `passkeys ${count('passkey')}` : undefined,
    count('api_key') > 0 ? `API keys ${count('api_key')}` : undefined,
    count('calendar_feed_tokens') > 0
      ? `calendar feeds ${count('calendar_feed_tokens')}`
      : undefined,
    ...providers.filter((provider) => provider !== 'credential').map((p) => `linked ${p}`),
    count('oauth_client') > 0 ? `OAuth clients ${count('oauth_client')}` : undefined,
    count('connection_tokens') > 0 ? `connected accounts ${count('connection_tokens')}` : undefined,
  ].filter((item): item is string => item !== undefined)
  return `${baseline.email}: ${held.length === 0 ? 'no sign-in method' : held.join(', ')}`
}

/**
 * Record, as each account a reset keeps stands now, the baseline the next
 * reset returns it to (`sovrium seed --baseline`), and answer what was
 * recorded. Only the operator of the machine moves a baseline: no endpoint,
 * automation or console button calls this.
 */
export const recordAccountBaselines = (
  listed: readonly SeedAccount[]
): Effect.Effect<readonly RecordedBaseline[], SeedResetError, SeedResetRepository> =>
  Effect.gen(function* () {
    const repository = yield* SeedResetRepository
    const baselines = yield* repository.readBaselines
    const admins = yield* repository.readHostAdmins(baselines)
    const kept = yield* resolveKeptListed(listed, baselines)
    const ids = (yield* repository.readAccounts)
      .filter((account) => isKept(account, kept, admins))
      .map((account) => account.id)
    const live = yield* Effect.forEach(ids, (id) => repository.captureBaseline(id))
    return yield* repository.recordBaselines(live.filter((baseline) => baseline !== undefined))
  }).pipe(
    Effect.withSpan('seed.record-account-baselines', { attributes: { listed: listed.length } })
  )
