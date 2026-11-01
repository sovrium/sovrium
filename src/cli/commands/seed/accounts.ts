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

import { checkAccountReferences } from '@/application/use-cases/seed/seed-checks'
import { assignableRoleNames, isAssignableRole } from '@/domain/models/app/auth/roles'
import { declaredBaseUrl } from '@/domain/models/process-env/server'
import { invitationLine } from '@/domain/models/seed/invitation-lines'
import { readAccountIndex } from './account-reads'
import { createUnclaimedSeedAccounts } from './unclaimed'
import type { SeedAccountReference } from '@/application/use-cases/seed/seed-checks'
import type { App } from '@/domain/models/app'
import type { SeedAccount } from '@/domain/models/seed'
import type { DatabaseService } from '@/infrastructure/database/drizzle/layer'

/** Account ids by lower-cased email. */
export type AccountIndex = ReadonlyMap<string, string>

/** The accounts a run would create, and the refusals that stop it. */
export interface AccountPlan {
  /** Listed accounts with no account yet, each with the password it will get. */
  readonly toCreate: readonly (SeedAccount & { readonly password: string })[]
  /** Listed `invited: true` accounts with no account yet — issued as pending invitations. */
  readonly toInvite: readonly SeedAccount[]
  /** Listed `unclaimed: true` accounts with no account yet — no credential, no invitation. */
  readonly toLeaveUnclaimed: readonly SeedAccount[]
  /** Listed accounts that already exist — left unchanged, a pending invitation included. */
  readonly existing: readonly SeedAccount[]
  readonly errors: readonly string[]
}

/** One invitation link a run issued, printed once. */
export interface IssuedInvitation {
  readonly email: string
  readonly link: string
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

/**
 * Invitations whose `invitedBy` names no account that can sign in: neither an
 * existing account nor one this file creates with a password — and never an
 * account that is itself still a pending invitation. An invitation "from"
 * someone who cannot sign in would print a sender nobody can be.
 */
const checkInviters = (
  accounts: readonly SeedAccount[],
  index: AccountIndex,
  pendingInvitees: ReadonlySet<string>
): readonly string[] => {
  const senders = new Set([
    ...index.keys(),
    ...accounts
      .filter((a) => a.invited !== true && a.unclaimed !== true)
      .map((a) => a.email.toLowerCase()),
  ])
  return accounts.flatMap((account) => {
    const sender = account.invitedBy?.toLowerCase()
    if (sender === undefined) return []
    if (pendingInvitees.has(sender)) {
      return [
        `accounts: "${account.email}" is invited by "${account.invitedBy}", which is itself a ` +
          `pending invitation and cannot sign in yet. Name an account that has accepted.`,
      ]
    }
    return senders.has(sender)
      ? []
      : [
          `accounts: "${account.email}" is invited by "${account.invitedBy}", which has no ` +
            `account. List it in seed/users.yaml without invited:, or create it first.`,
        ]
  })
}

/** Accounts, `--as` and `@user:` all need the auth layer. */
const checkAuthConfigured = (app: Readonly<App>, needed: boolean): readonly string[] =>
  needed && !app.auth
    ? [
        'Seeding accounts, --as and @user: values need sign-in accounts, and this app ' +
          'declares no auth: block. Add one, or remove them from the seed data.',
      ]
    : []

/** The password a new account gets: its own, else `SOVRIUM_SEED_PASSWORD`, else none. */
const passwordOf = (
  account: SeedAccount,
  fallbackPassword: string | undefined
): string | undefined =>
  account.password !== undefined && account.password.length > 0
    ? account.password
    : fallbackPassword !== undefined && fallbackPassword.length > 0
      ? fallbackPassword
      : undefined

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
  /** The existing accounts still pending an invitation (see {@link readPendingInvitees}). */
  readonly pendingInvitees?: ReadonlySet<string>
}): AccountPlan => {
  const { accounts, index, fallbackPassword } = input
  const existing = accounts.filter((account) => index.has(account.email.toLowerCase()))
  const unseen = accounts.filter((account) => !index.has(account.email.toLowerCase()))
  // Invited and unclaimed accounts take no password: their owner sets one later.
  const fresh = unseen.filter((account) => account.invited !== true && account.unclaimed !== true)
  const toInvite = unseen.filter((account) => account.invited === true)
  const toLeaveUnclaimed = unseen.filter((account) => account.unclaimed === true)
  const password = (account: SeedAccount): string | undefined =>
    passwordOf(account, fallbackPassword)
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
          ...checkInviters(accounts, index, input.pendingInvitees ?? new Set()),
          ...checkActingAccount(input.actingAs, known),
          ...checkAccountReferences(input.references, known),
        ]

  return {
    toCreate: fresh.flatMap((account) => {
      const secret = password(account)
      return secret === undefined ? [] : [{ ...account, password: secret }]
    }),
    toInvite,
    toLeaveUnclaimed,
    existing,
    errors,
  }
}

/** Refusal raised while creating an account — its message is printed verbatim. */
export class SeedAccountError extends Error {
  /**
   * The invitations the run issued before it stopped. They exist, and a replay
   * leaves an existing account as it is, so their links are printed with the
   * refusal — or nobody could ever be handed them.
   */
  readonly invitations: readonly IssuedInvitation[]

  constructor(message: string, invitations: readonly IssuedInvitation[] = []) {
    super(message)
    this.invitations = invitations
  }
}

/**
 * The origin an invitation link names: a seed run answers no request, so only
 * `BASE_URL`; without it the link is the page's path alone.
 */
const invitationOrigin = (): string => declaredBaseUrl(Bun.env) ?? ''

/**
 * Issue the planned invitations, sending nothing: each invitee gets an account
 * with no credential and a stored token, from the account `invitedBy` names.
 */
const issuePlannedInvitations = async (
  app: Readonly<App>,
  plan: AccountPlan,
  index: AccountIndex
): Promise<readonly IssuedInvitation[]> => {
  if (plan.toInvite.length === 0) return []
  const { inviteAccounts } = await import('@/index')
  const outcomes = await inviteAccounts(
    app,
    plan.toInvite.map((account) => ({
      email: account.email,
      name: account.name,
      role: account.role,
      inviterId:
        account.invitedBy === undefined ? undefined : index.get(account.invitedBy.toLowerCase()),
    })),
    invitationOrigin()
  )
  const failures = outcomes.flatMap((outcome) =>
    outcome.ok ? [] : [`accounts: "${outcome.email}": ${outcome.message}`]
  )
  const issued = outcomes.flatMap((outcome) =>
    outcome.ok ? [{ email: outcome.email, link: outcome.link }] : []
  )
  if (failures.length > 0) {
    throw new SeedAccountError(failures.join('\n  '), issued)
  }
  return issued
}

/**
 * Create the planned accounts and the unclaimed ones, then issue the planned
 * invitations, and return the index the rows are written with and the links to print.
 *
 * Throws {@link SeedAccountError} naming the email when the auth layer refuses
 * one (an invalid email, a password the policy rejects) — the run stops before
 * any table is touched.
 */
export const createPlannedAccounts = async (
  { client, dialect }: DatabaseService,
  app: Readonly<App>,
  plan: AccountPlan
): Promise<{
  readonly accounts: AccountIndex
  readonly invitations: readonly IssuedInvitation[]
}> => {
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
  const unclaimedFailures = await createUnclaimedSeedAccounts(app, plan.toLeaveUnclaimed)
  if (unclaimedFailures.length > 0) throw new SeedAccountError(unclaimedFailures.join('\n  '))
  const created = await readAccountIndex({ client, dialect })
  const invitations = await issuePlannedInvitations(app, plan, created)
  return {
    accounts: invitations.length === 0 ? created : await readAccountIndex({ client, dialect }),
    invitations,
  }
}

/** `, unclaimed N` when the run creates unclaimed accounts, else nothing. */
const unclaimedSegment = (plan: AccountPlan, label: string): string =>
  plan.toLeaveUnclaimed.length === 0 ? '' : `, ${label} ${plan.toLeaveUnclaimed.length}`

/**
 * The report lines for the accounts step — none when no file lists any — and
 * each new invitation's link, printed this once: the token is written nowhere
 * else, and a replay leaves the invitation as it is.
 */
export const accountReportLines = (
  plan: AccountPlan,
  dryRun: boolean,
  invitations: readonly IssuedInvitation[] = []
): readonly string[] =>
  plan.toCreate.length +
    plan.toInvite.length +
    plan.toLeaveUnclaimed.length +
    plan.existing.length ===
  0
    ? []
    : [
        dryRun
          ? `[dry-run] accounts: would create ${plan.toCreate.length}, would invite ` +
            `${plan.toInvite.length}${unclaimedSegment(plan, 'would leave unclaimed')}, ` +
            `${plan.existing.length} already present`
          : `accounts: created ${plan.toCreate.length}, invited ${plan.toInvite.length}` +
            `${unclaimedSegment(plan, 'unclaimed')}, ${plan.existing.length} already present`,
        ...invitationReportLines(invitations),
      ]

/** One line per issued invitation, its link included — printed once, on stdout. */
export const invitationReportLines = (
  invitations: readonly IssuedInvitation[]
): readonly string[] =>
  invitations.map((invitation) => invitationLine(invitation.email, invitation.link))
