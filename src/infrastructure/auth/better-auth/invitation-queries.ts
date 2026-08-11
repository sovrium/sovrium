/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, eq, like } from 'drizzle-orm'
import { db } from '@/infrastructure/database'
import { accounts, users, verifications } from './schema'

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
 * Insert a new invitation token row into auth.verification.
 *
 * - identifier: `invitation:<token>` so we can find by token
 * - value:      the invited user's id (so accept knows which user to set up)
 */
export async function insertInvitationToken(params: {
  readonly id: string
  readonly token: string
  readonly userId: string
  readonly expiresAt: Date
}): Promise<void> {
  // eslint-disable-next-line functional/no-expression-statements -- DB insert is a side effect
  await db.insert(verifications).values({
    id: params.id,
    identifier: buildInvitationIdentifier(params.token),
    value: params.userId,
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
    userId: row.value,
    expiresAt: row.expiresAt,
  }
}

/**
 * Delete an invitation token row by id (single-use enforcement).
 */
export async function deleteInvitationToken(id: string): Promise<void> {
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
  // eslint-disable-next-line functional/no-expression-statements -- DB delete is a side effect
  await db
    .delete(verifications)
    .where(
      and(
        like(verifications.identifier, `${INVITATION_IDENTIFIER_PREFIX}%`),
        eq(verifications.value, userId)
      )
    )
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
  const rows = await db
    .select({ password: accounts.password })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, 'credential')))
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
  // eslint-disable-next-line functional/no-expression-statements -- DB insert is a side effect
  await db.insert(accounts).values({
    id: params.id,
    accountId: params.userId,
    providerId: 'credential',
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
  // eslint-disable-next-line functional/no-expression-statements -- DB delete is a side effect
  await db
    .delete(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, 'credential')))
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
  const rows = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  return rows[0]
}
