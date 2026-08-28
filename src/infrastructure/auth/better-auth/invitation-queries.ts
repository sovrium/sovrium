/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, eq, inArray, like } from 'drizzle-orm'
import { db } from '@/infrastructure/database'
import {
  authAccountsTable,
  authUsersTable,
  authVerificationsTable,
} from '@/infrastructure/database/drizzle/dialect-schema'
import { credentialIssuer } from './account-issuer'

/**
 * Identifier prefix used for admin invitation verification rows.
 *
 * Sovrium reuses Better Auth's `auth.verification` table as a single
 * single-use token store. The `invitation:` prefix segregates these rows
 * from password-reset / email-verification rows so only the admin invitation
 * flow can consume them.
 */
export const INVITATION_IDENTIFIER_PREFIX = 'invitation:'

/**
 * Build the verification.identifier value for a stored invitation token.
 *
 * Storing the identifier (rather than the value) as the primary lookup key
 * means the per-user index `verification_identifier_idx` covers our reads.
 */
export const buildInvitationIdentifier = (token: string): string =>
  `${INVITATION_IDENTIFIER_PREFIX}${token}`

/**
 * Persisted invitation token row.
 */
export interface InvitationTokenRow {
  readonly id: string
  readonly token: string
  readonly userId: string
  readonly expiresAt: Date
}

/**
 * What the `verification.value` column carries for an invitation row.
 *
 * Better Auth owns the `verification` TABLE but never reads OUR rows — they are
 * namespaced by the `invitation:` identifier prefix — so the column's payload is
 * Sovrium's to define. It began as the bare invitee user id, which is why the
 * two shapes below both have to be readable: rows written before the operator
 * list existed carry the bare id and must keep resolving rather than becoming
 * un-acceptable invitations on upgrade.
 *
 * The envelope exists because the pending-invitation list has to answer "who
 * sent this?", and the inviter was previously persisted NOWHERE — not on the
 * verification row (which has no spare column) and not on the invitee's user
 * record. Encoding it here keeps the whole invitation in ONE row and needs no
 * migration against a vendored auth table.
 *
 * {@link encodeInvitationValue} and {@link decodeInvitationValue} are the only
 * two places that know this, so the storage choice stays swappable.
 */
interface InvitationValueEnvelope {
  readonly userId: string
  readonly invitedBy?: string | undefined
}

/**
 * Encode the invitation payload for the `verification.value` column.
 *
 * Emits the BARE user id when there is no inviter to record, so the common row
 * stays byte-identical to what the flow wrote before and no reader anywhere has
 * to change to keep working.
 */
const encodeInvitationValue = (userId: string, invitedBy?: string | undefined): string =>
  invitedBy === undefined || invitedBy.length === 0
    ? userId
    : JSON.stringify({ userId, invitedBy } satisfies InvitationValueEnvelope)

/**
 * Decode a `verification.value` payload back into the invitation envelope.
 *
 * Falls back to treating the raw string as a bare user id whenever it is not
 * the JSON envelope — which covers rows written by an older build AND a value
 * that happens to be malformed. A user id that cannot be parsed is strictly
 * worse than one without an inviter: it would orphan a live invitation.
 */
const decodeInvitationValue = (value: string): InvitationValueEnvelope => {
  if (!value.startsWith('{')) return { userId: value }
  try {
    const parsed = JSON.parse(value) as Partial<InvitationValueEnvelope>
    if (typeof parsed.userId !== 'string' || parsed.userId.length === 0) {
      return { userId: value }
    }
    return {
      userId: parsed.userId,
      invitedBy: typeof parsed.invitedBy === 'string' ? parsed.invitedBy : undefined,
    }
  } catch {
    return { userId: value }
  }
}

/**
 * Insert a new invitation token row into auth.verification.
 *
 * - identifier: `invitation:<token>` so we can find by token
 * - value:      the invited user's id, plus the inviter's id when known
 *               (see {@link InvitationValueEnvelope})
 */
export async function insertInvitationToken(params: {
  readonly id: string
  readonly token: string
  readonly userId: string
  readonly expiresAt: Date
  readonly invitedBy?: string | undefined
}): Promise<void> {
  const verifications = authVerificationsTable()
  // eslint-disable-next-line functional/no-expression-statements -- DB insert is a side effect
  await db.insert(verifications).values({
    id: params.id,
    identifier: buildInvitationIdentifier(params.token),
    value: encodeInvitationValue(params.userId, params.invitedBy),
    expiresAt: params.expiresAt,
  })
}

/**
 * Look up an invitation token row by token value.
 *
 * Returns undefined if no row matches (token was never issued, was already
 * consumed, or has been deleted manually).
 */
export async function findInvitationToken(token: string): Promise<InvitationTokenRow | undefined> {
  const verifications = authVerificationsTable()
  const rows = await db
    .select({
      id: verifications.id,
      identifier: verifications.identifier,
      value: verifications.value,
      expiresAt: verifications.expiresAt,
    })
    .from(verifications)
    .where(eq(verifications.identifier, buildInvitationIdentifier(token)))
    .limit(1)

  const row = rows[0]
  if (!row) return undefined

  return {
    id: row.id,
    token,
    userId: decodeInvitationValue(row.value).userId,
    expiresAt: row.expiresAt,
  }
}

/**
 * Push an invitation's expiry out to a new deadline.
 *
 * Used by resend: the same token is delivered again, so an invitation that was
 * about to lapse would otherwise arrive as a link that dies moments later.
 */
// eslint-disable-next-line functional/prefer-immutable-types -- Date is structurally mutable; Drizzle takes the instance as-is and this function never mutates it
export async function refreshInvitationExpiry(id: string, expiresAt: Date): Promise<void> {
  const verifications = authVerificationsTable()
  // eslint-disable-next-line functional/no-expression-statements -- DB update is a side effect
  await db.update(verifications).set({ expiresAt }).where(eq(verifications.id, id))
}

/**
 * Delete an invitation token row by id (single-use enforcement).
 */
export async function deleteInvitationToken(id: string): Promise<void> {
  const verifications = authVerificationsTable()
  // eslint-disable-next-line functional/no-expression-statements -- DB delete is a side effect
  await db.delete(verifications).where(eq(verifications.id, id))
}

/**
 * Delete every pending invitation token issued for a given user.
 *
 * Used when re-issuing an invitation to the same email to ensure only one
 * token is ever live at a time.
 */
export async function deletePendingInvitationsForUser(userId: string): Promise<void> {
  const verifications = authVerificationsTable()
  // Matched in memory rather than with `eq(value, userId)`: `value` now carries
  // either a bare user id or the JSON envelope (see `encodeInvitationValue`), so
  // an equality predicate would silently skip every enveloped row — leaving the
  // stale grants this function exists to clear. The scan is bounded to the
  // invitation rows by the identifier prefix, which the
  // `verification_identifier_idx` index covers.
  const rows = await db
    .select({ id: verifications.id, value: verifications.value })
    .from(verifications)
    .where(like(verifications.identifier, `${INVITATION_IDENTIFIER_PREFIX}%`))

  const staleIds = rows
    .filter((row) => decodeInvitationValue(row.value).userId === userId)
    .map((row) => row.id)
  if (staleIds.length === 0) return

  // eslint-disable-next-line functional/no-expression-statements -- DB delete is a side effect
  await db.delete(verifications).where(inArray(verifications.id, staleIds))
}

/**
 * One pending invitation, joined with the invitee's account.
 *
 * `invitedBy` is the INVITER'S USER ID (or undefined for a row written before
 * the inviter was recorded); resolving it to an address is the caller's job.
 * The token is deliberately absent — see {@link listPendingInvitations}.
 */
export interface PendingInvitationRow {
  readonly id: string
  readonly userId: string
  readonly email: string
  readonly role: string | null
  readonly invitedBy: string | undefined
  readonly expiresAt: Date
  readonly createdAt: Date
}

/**
 * List every outstanding invitation, newest first, joined to the invitee's
 * `auth.user` row for the address and role the operator needs to act on.
 *
 * EXPIRED ROWS ARE INCLUDED. Filtering them out here would collapse two
 * different operator problems — "it expired, resend it" and "it was never
 * sent" — into one indistinguishable empty list; the caller derives the status
 * from `expiresAt` instead.
 *
 * The invitation TOKEN is never selected. It is the credential that accepts the
 * invitation, and this list is an operator surface that ends up in logs,
 * screenshots and browser history; the row `id` is what identifies an
 * invitation to everything above this layer.
 */
export async function listPendingInvitations(): Promise<readonly PendingInvitationRow[]> {
  const verifications = authVerificationsTable()
  const users = authUsersTable()

  const rows = await db
    .select({
      id: verifications.id,
      value: verifications.value,
      expiresAt: verifications.expiresAt,
      createdAt: verifications.createdAt,
    })
    .from(verifications)
    .where(like(verifications.identifier, `${INVITATION_IDENTIFIER_PREFIX}%`))

  const decoded = rows.map((row) => ({ row, value: decodeInvitationValue(row.value) }))

  // Accounts are resolved in a SECOND bounded read rather than a SQL join. The
  // join key lives INSIDE the `value` payload, which is a bare id on older rows
  // and a JSON envelope on newer ones, so no single SQL equality can address
  // both — a join would quietly return nothing for one of the two shapes. The
  // `IN` list is bounded by the pending-invitation count.
  const subjectIds = [
    ...new Set([
      ...decoded.map(({ value }) => value.userId),
      ...decoded.flatMap(({ value }) => (value.invitedBy === undefined ? [] : [value.invitedBy])),
    ]),
  ]
  if (subjectIds.length === 0) return []

  const accounts = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(inArray(users.id, subjectIds))
  const accountsById = new Map(accounts.map((account) => [account.id, account]))

  // An invitation whose invitee account is gone is not actionable — there is
  // nobody left to resend to — so it is dropped rather than listed with a blank
  // address.
  return decoded.flatMap(({ row, value }) => {
    const invitee = accountsById.get(value.userId)
    if (!invitee) return []
    const inviter = value.invitedBy === undefined ? undefined : accountsById.get(value.invitedBy)
    return [
      {
        id: row.id,
        userId: value.userId,
        email: invitee.email,
        role: invitee.role,
        invitedBy: inviter?.email,
        expiresAt: row.expiresAt,
        createdAt: row.createdAt,
      },
    ]
  })
}

/**
 * Look up one invitation row by its opaque row id — the identifier the operator
 * surfaces carry, as opposed to the token, which only the invitee ever holds.
 */
export async function findInvitationById(id: string): Promise<InvitationTokenRow | undefined> {
  const verifications = authVerificationsTable()
  const rows = await db
    .select({
      id: verifications.id,
      identifier: verifications.identifier,
      value: verifications.value,
      expiresAt: verifications.expiresAt,
    })
    .from(verifications)
    .where(
      and(
        eq(verifications.id, id),
        // Scoped to invitation rows so an id belonging to a password-reset or
        // e-mail-verification row cannot be resent or revoked through the
        // invitation endpoints.
        like(verifications.identifier, `${INVITATION_IDENTIFIER_PREFIX}%`)
      )
    )
    .limit(1)

  const row = rows[0]
  if (!row) return undefined

  return {
    id: row.id,
    token: row.identifier.slice(INVITATION_IDENTIFIER_PREFIX.length),
    userId: decodeInvitationValue(row.value).userId,
    expiresAt: row.expiresAt,
  }
}

/**
 * Look up a Better Auth user by email (case-insensitive on the email column).
 *
 * Returns undefined if no user exists with that email. Better Auth lower-cases
 * emails on insert via the drizzle adapter, so an exact match is sufficient
 * provided callers have already lower-cased their query value.
 */
export async function findUserByEmail(
  email: string
): Promise<{ readonly id: string; readonly email: string; readonly name: string } | undefined> {
  const users = authUsersTable()
  const normalizedEmail = email.toLowerCase()
  const rows = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1)
  return rows[0]
}

/**
 * Check whether a user has a credential account row with a non-null password.
 *
 * Used to detect "already onboarded" — an invitation cannot be issued to an
 * email that already has a usable password (the customer should reset their
 * password instead).
 */
export async function userHasCredentialPassword(userId: string): Promise<boolean> {
  const accounts = authAccountsTable()
  const rows = await db
    .select({ password: accounts.password })
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, userId),
        eq(accounts.providerId, 'credential'),
        eq(accounts.issuer, credentialIssuer())
      )
    )
    .limit(1)
  const row = rows[0]
  return Boolean(row?.password)
}

/**
 * Insert a credential account row for an invited user once they accept.
 *
 * This mirrors what Better Auth does internally on first sign-up: link a
 * credential account with the bcrypt-hashed password.
 */
export async function insertCredentialAccount(params: {
  readonly id: string
  readonly userId: string
  readonly hashedPassword: string
}): Promise<void> {
  const accounts = authAccountsTable()
  // eslint-disable-next-line functional/no-expression-statements -- DB insert is a side effect
  await db.insert(accounts).values({
    id: params.id,
    accountId: params.userId,
    providerId: 'credential',
    // Load-bearing. Credential lookups match on `issuer`, so a row written
    // without one is invisible: the invited customer can neither sign in nor
    // reset their password, and the insert itself still succeeds.
    issuer: credentialIssuer(),
    userId: params.userId,
    password: params.hashedPassword,
  })
}

/**
 * Mark a user's email as verified.
 *
 * Customers accepting an invitation have proven control of their email by
 * clicking the link, so we can flip emailVerified=true on accept.
 */
export async function markUserEmailVerified(userId: string): Promise<void> {
  const users = authUsersTable()
  // eslint-disable-next-line functional/no-expression-statements -- DB update is a side effect
  await db.update(users).set({ emailVerified: true }).where(eq(users.id, userId))
}

/**
 * Remove the credential account row Better Auth linked when its
 * admin.createUser API ran with our throwaway password. Without this the
 * bogus password would remain a usable login path until the customer
 * accepted the invitation.
 *
 * Idempotent — deletes 0 rows when the user has no credential account
 * (e.g. an OAuth-only user who was promoted via invitation).
 */
export async function deleteCredentialAccountForUser(userId: string): Promise<void> {
  const accounts = authAccountsTable()
  // Matched on `issuer` as well as `providerId`, mirroring how Better Auth
  // itself resolves credential accounts. Every credential row carries
  // `local:credential`: writers set it, and the migration that introduced the
  // column backfilled every pre-existing row, so narrowing the match here
  // cannot leave a throwaway password behind.
  // eslint-disable-next-line functional/no-expression-statements -- DB delete is a side effect
  await db
    .delete(accounts)
    .where(
      and(
        eq(accounts.userId, userId),
        eq(accounts.providerId, 'credential'),
        eq(accounts.issuer, credentialIssuer())
      )
    )
}

/**
 * Find a Better Auth user by id, returning the lean (id, email, name)
 * shape used by the admin-invitation accept flow. Returns `undefined`
 * when the user has been deleted between issuing and accepting the
 * invitation (a rare race).
 */
export async function findUserById(
  userId: string
): Promise<{ readonly id: string; readonly email: string; readonly name: string } | undefined> {
  const users = authUsersTable()
  const rows = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  return rows[0]
}
