/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Which accounts an `app/seed` reset keeps, and returning them to their
 * baselines (`seed-self-baseline.ts`).
 *
 * A reset keeps the accounts `seed/users.yaml` lists and the host's
 * administrators. A listed account is found by its address — or, when a
 * baseline was recorded with an address the file still lists, by the id that
 * baseline names, so an account whose email a visitor changed is still the
 * listed one and is put back rather than erased.
 */

import { sql } from 'drizzle-orm'
import { db } from '@/infrastructure/database'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import { authUserTableRef } from '@/infrastructure/database/sql/dialect-sql'
import {
  captureBaseline,
  firstBaseline,
  recordBaselines,
  type RecordedBaseline,
} from './seed-self-baseline'
import { restoreBaselines } from './seed-self-baseline-restore'
import { platformAdminCloudLink } from './seed-self-clear'
import type { HostAdmin } from './seed-self-admins'
import type { SeedAccount } from '@/domain/models/seed'

/** Every account, with its id and lower-cased email. */
export const readAccounts = async (): Promise<
  readonly { readonly id: string; readonly email: string }[]
> =>
  (await executeRaw(db, sql`SELECT id, email FROM ${authUserTableRef()}`)).flatMap((row) =>
    typeof row.email === 'string' ? [{ id: String(row.id), email: row.email.toLowerCase() }] : []
  )

/** The listed accounts a reset keeps: by baseline id where one names a listed address, else by address. */
export interface KeptListed {
  /** Accounts kept by the id their baseline recorded. */
  readonly ids: ReadonlySet<string>
  /** Listed addresses kept by address: those no recognised baseline answers for. */
  readonly emails: ReadonlySet<string>
}

/** Resolve the listed accounts against the recorded baselines and the accounts that exist. */
export const resolveKeptListed = async (
  listed: readonly SeedAccount[],
  baselines: ReadonlyMap<string, RecordedBaseline>
): Promise<KeptListed> => {
  const addresses = new Set(listed.map((account) => account.email.toLowerCase()))
  const existing = new Set((await readAccounts()).map((account) => account.id))
  const recognised = [...baselines.values()].filter(
    (baseline) => addresses.has(baseline.email) && existing.has(baseline.userId)
  )
  const answered = new Set(recognised.map((baseline) => baseline.email))
  return {
    ids: new Set(recognised.map((baseline) => baseline.userId)),
    emails: new Set([...addresses].filter((email) => !answered.has(email))),
  }
}

/** Whether an account is one the reset keeps. */
export const isKept = (
  account: { readonly id: string; readonly email: string },
  kept: KeptListed,
  admins: readonly HostAdmin[]
): boolean =>
  kept.emails.has(account.email) ||
  kept.ids.has(account.id) ||
  admins.some((admin) => admin.id === account.id)

/**
 * Return each kept account with a baseline to it — the listed ones recognised
 * by their baseline, and the host's administrators, the one `AUTH_ADMIN_EMAIL`
 * names only when its baseline was recorded with that address — and answer
 * those baselines, by account id. One with no baseline that applies keeps
 * only what `clearKeptSignInMaterial` left it — its password and, for the
 * platform administrator, its Cloud link — and gets one at the end of the reset.
 */
export const restoreKeptBaselines = async (
  baselines: ReadonlyMap<string, RecordedBaseline>,
  kept: KeptListed,
  admins: readonly HostAdmin[]
): Promise<ReadonlyMap<string, RecordedBaseline>> => {
  const applies = (baseline: RecordedBaseline): boolean => {
    if (kept.ids.has(baseline.userId)) return true
    const admin = admins.find((candidate) => candidate.id === baseline.userId)
    // `AUTH_ADMIN_EMAIL` changed on purpose: the baseline recorded under the old address is not it.
    return admin !== undefined && (!admin.byEmail || admin.email === baseline.email)
  }
  const applied = [...baselines.values()].filter(applies)
  await restoreBaselines(applied, platformAdminCloudLink())
  return new Map(applied.map((baseline) => [baseline.userId, baseline] as const))
}

/**
 * Record the baseline of every account the reset kept, as it ends — the listed
 * accounts, the seed has just created included, and the host's administrators.
 *
 * Nothing is read back for an account `applied` restored: its baseline stays
 * the copy it was just returned to. Every other account's copy is read now and
 * cut to its first baseline (`firstBaseline`), under the address it was kept
 * for. Either way, what anyone signed in to the app does while the seed is
 * being written — a key created, a second factor turned on, an address
 * changed — never becomes what the next reset puts back.
 */
export const recordKeptBaselines = async (
  listed: readonly SeedAccount[],
  admins: readonly HostAdmin[],
  applied: ReadonlyMap<string, RecordedBaseline>
): Promise<readonly RecordedBaseline[]> => {
  const addresses = new Set(listed.map((account) => account.email.toLowerCase()))
  const listedFor = new Map(
    (await readAccounts())
      .filter((account) => addresses.has(account.email))
      .map((account) => [account.id, account.email] as const)
  )
  const keptFor = new Map<string, string | undefined>([
    ...listedFor,
    ...admins.map(
      (admin) => [admin.id, admin.byEmail ? admin.email : listedFor.get(admin.id)] as const
    ),
  ])
  const entries = await Promise.all(
    [...new Set([...applied.keys(), ...keptFor.keys()])].map(async (userId) => {
      const restored = applied.get(userId)
      if (restored !== undefined) return restored
      const snapshot = await captureBaseline(userId)
      return snapshot === undefined
        ? undefined
        : firstBaseline(userId, snapshot, keptFor.get(userId))
    })
  )
  return recordBaselines(entries.filter((entry) => entry !== undefined))
}
