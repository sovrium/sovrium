/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Sign-in accounts for a seed run: the ones `seed/users.yaml` creates, the one
 * `--as <email>` writes as, and the ones `@user:<email>` values point at.
 *
 * ## Why every account question is answered before any row is written
 *
 * An unknown `--as`, an unknown `@user:`, and a new account with no password
 * available are all refusals, and a refusal raised after some rows landed
 * leaves the retry looking at a non-empty table that `--mode if-empty` then
 * skips forever. So the whole account picture — who exists, who the run will
 * create, and whether it CAN create them — is settled first, and only then are
 * accounts created and rows written.
 *
 * ## Why accounts go through `sovrium admin create`'s path
 *
 * A row written straight into the user table has no credential, so it exists
 * and cannot sign in. `createAccounts` is the path `sovrium admin create`
 * takes — Better Auth's own `createUser`, the verified-email handling, the
 * password policy — run once for the whole list.
 */

import { sql } from 'drizzle-orm'
import { checkAccountReferences } from '@/application/use-cases/seed/seed-checks'
import { assignableRoleNames, isAssignableRole } from '@/domain/models/app/auth/roles'
import { db } from '@/infrastructure/database'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import { authUserTableRef } from '@/infrastructure/database/sql/dialect-sql'
import type { SeedAccountReference } from '@/application/use-cases/seed/seed-checks'
import type { App } from '@/domain/models/app'
import type { SeedAccount } from '@/domain/models/seed'

/** Account ids by lower-cased email. */
export type AccountIndex = ReadonlyMap<string, string>

/** The accounts a run would create, and the refusals that stop it. */
export interface AccountPlan {
  /** Listed accounts with no account yet, each with the password it will get. */
  readonly toCreate: readonly (SeedAccount & { readonly password: string })[]
  /** Listed accounts that already exist — left unchanged. */
  readonly existing: readonly SeedAccount[]
  readonly errors: readonly string[]
}

/**
 * Every account in the database, by lower-cased email.
 *
 * The auth tables are created by the migrations every seed run applies first,
 * whether or not the app configures `auth:`, so an app without accounts reads
 * an empty table. A failing read is therefore a real failure and is not
 * swallowed: treated as "no accounts", it would turn an unreachable database
 * into a misleading "no account has that email" refusal.
 */
export const readAccountIndex = async (): Promise<AccountIndex> => {
  const rows = await executeRaw(db, sql`SELECT id, email FROM ${authUserTableRef()}`)
  return new Map(
    rows.flatMap((row) =>
      typeof row.email === 'string' && (typeof row.id === 'string' || typeof row.id === 'number')
        ? [[row.email.toLowerCase(), String(row.id)] as const]
        : []
    )
  )
}

/** `--as <email>` naming no account, existing or about to be created. */
const checkActingAccount = (
  actingAs: string | undefined,
  known: ReadonlySet<string>
): readonly string[] =>
  actingAs === undefined || known.has(actingAs.toLowerCase())
    ? []
    : [
        `--as ${actingAs}: no account has that email. ` +
          `Create it with sovrium admin create, or list it in seed/users.yaml.`,
      ]

/**
 * Accounts whose role this app does not define.
 *
 * The auth layer refuses such a role too, but only while creating the account —
 * after the accounts listed before it already exist. A typo like `memeber` must
 * stop the run while nothing has been written, and it is checked against every
 * listed account, existing ones included, so the answer does not depend on
 * which accounts a previous run happened to create.
 */
const checkAccountRoles = (
  app: Readonly<App>,
  accounts: readonly SeedAccount[]
): readonly string[] => {
  const invalid = accounts.filter((account) => !isAssignableRole(account.role, app))
  if (invalid.length === 0) return []
  const valid = [...assignableRoleNames(app)].toSorted().join(', ')
  return invalid.map(
    (account) =>
      `accounts: "${account.email}" has the role "${account.role}", which this app does not ` +
      `define. Valid roles: ${valid}.`
  )
}

/** Accounts, `--as` and `@user:` all need the auth layer. */
const checkAuthConfigured = (app: Readonly<App>, needed: boolean): readonly string[] =>
  needed && !app.auth
    ? [
        'Seeding accounts, --as and @user: values need sign-in accounts, and this app ' +
          'declares no auth: block. Add one, or remove them from the seed data.',
      ]
    : []

/**
 * Settle every account question for a run, writing nothing.
 *
 * `fallbackPassword` is `SOVRIUM_SEED_PASSWORD`. It is only needed by an
 * account that does not exist yet: an existing one is left unchanged, so a
 * replay without the variable set is not a refusal.
 */
export const planAccounts = (input: {
  readonly app: Readonly<App>
  readonly accounts: readonly SeedAccount[]
  readonly index: AccountIndex
  readonly references: readonly SeedAccountReference[]
  readonly actingAs: string | undefined
  readonly fallbackPassword: string | undefined
}): AccountPlan => {
  const { accounts, index, fallbackPassword } = input
  const existing = accounts.filter((account) => index.has(account.email.toLowerCase()))
  const fresh = accounts.filter((account) => !index.has(account.email.toLowerCase()))
  const password = (account: SeedAccount): string | undefined =>
    account.password !== undefined && account.password.length > 0
      ? account.password
      : fallbackPassword !== undefined && fallbackPassword.length > 0
        ? fallbackPassword
        : undefined
  const known = new Set([...index.keys(), ...accounts.map((a) => a.email.toLowerCase())])

  const needsAuth =
    accounts.length > 0 || input.references.length > 0 || input.actingAs !== undefined
  const authErrors = checkAuthConfigured(input.app, needsAuth)
  const errors =
    authErrors.length > 0
      ? authErrors
      : [
          ...checkAccountRoles(input.app, accounts),
          ...fresh
            .filter((account) => password(account) === undefined)
            .map(
              (account) =>
                `accounts: "${account.email}" has no password. Give it a password: in ` +
                `seed/users.yaml, or set SOVRIUM_SEED_PASSWORD.`
            ),
          ...checkActingAccount(input.actingAs, known),
          ...checkAccountReferences(input.references, known),
        ]

  return {
    toCreate: fresh.flatMap((account) => {
      const secret = password(account)
      return secret === undefined ? [] : [{ ...account, password: secret }]
    }),
    existing,
    errors,
  }
}

/** Refusal raised while creating an account — its message is printed verbatim. */
export class SeedAccountError extends Error {}

/**
 * Create the planned accounts and return the index the rows are written with.
 *
 * Throws {@link SeedAccountError} naming the email when the auth layer refuses
 * one (an invalid email, a password the policy rejects) — the run stops before
 * any table is touched.
 */
export const createPlannedAccounts = async (
  app: Readonly<App>,
  plan: AccountPlan
): Promise<AccountIndex> => {
  if (plan.toCreate.length > 0) {
    const { createAccounts } = await import('@/index')
    const results = await createAccounts(app, plan.toCreate)
    const failures = results.flatMap((result, position) =>
      result.ok ? [] : [`accounts: "${plan.toCreate[position]?.email}": ${result.message}`]
    )
    if (failures.length > 0) {
      throw new SeedAccountError(failures.join('\n  '))
    }
  }
  return readAccountIndex()
}

/** The report line for the accounts step, or none when no file lists any. */
export const accountReportLines = (plan: AccountPlan, dryRun: boolean): readonly string[] =>
  plan.toCreate.length + plan.existing.length === 0
    ? []
    : [
        dryRun
          ? `[dry-run] accounts: would create ${plan.toCreate.length}, ${plan.existing.length} already present`
          : `accounts: created ${plan.toCreate.length}, ${plan.existing.length} already present`,
      ]
