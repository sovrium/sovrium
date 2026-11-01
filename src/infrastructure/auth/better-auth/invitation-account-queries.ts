/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The invitee's account rows the invitation flow reads and writes: the user it
 * names, and the credential account an accepted invitation sets a password on.
 * The token rows themselves live in `invitation-queries.ts`.
 */

import { and, eq } from 'drizzle-orm'
import { authAccountsTable, authUsersTable } from '@/infrastructure/database/drizzle/dialect-schema'
import type { InvitationUser } from '@/application/ports/contracts/invitation-services'
import type { PortableDb } from '@/infrastructure/database/drizzle/db'

/**
 * Look up a Better Auth user by email (case-insensitive on the email column).
 *
 * Returns undefined if no user exists with that email. Better Auth lower-cases
 * emails on insert via the drizzle adapter, so an exact match is sufficient
 * provided callers have already lower-cased their query value.
 */
export async function findUserByEmail(
  db: PortableDb,
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
export async function userHasCredentialPassword(db: PortableDb, userId: string): Promise<boolean> {
  const accounts = authAccountsTable()
  const rows = await db
    .select({ password: accounts.password })
    .from(accounts)
    .where(
      // Keyed on `(userId, providerId)`, the identity Better Auth resolves
      // credential accounts by. `issuer` is a retired column: Better Auth no
      // longer writes it, so a predicate on it would miss every new row.
      and(eq(accounts.userId, userId), eq(accounts.providerId, 'credential'))
    )
    .limit(1)
  const row = rows[0]
  return Boolean(row?.password)
}

/**
 * Insert a credential account row for an invited user once they accept.
 *
 * This mirrors what Better Auth does internally on first sign-up: link a
 * credential account with the scrypt-hashed password.
 */
export async function insertCredentialAccount(
  db: PortableDb,
  params: {
    readonly id: string
    readonly userId: string
    readonly hashedPassword: string
  }
): Promise<void> {
  const accounts = authAccountsTable()
  await db.insert(accounts).values({
    id: params.id,
    accountId: params.userId,
    providerId: 'credential',
    // No `issuer`: Better Auth identifies accounts by `(providerId, accountId)`
    // and leaves that retired column NULL on the rows it writes, so this row
    // matches them.
    userId: params.userId,
    password: params.hashedPassword,
  })
}

/**
 * Mark a user's email as verified — following the invitation link proves the
 * mailbox — and answer whether it was NOT verified before (the flip happened).
 */
export async function markUserEmailVerified(db: PortableDb, userId: string): Promise<boolean> {
  const users = authUsersTable()
  const flipped = await db
    .update(users)
    .set({ emailVerified: true })
    .where(and(eq(users.id, userId), eq(users.emailVerified, false)))
    .returning({ id: users.id })
  return flipped.length > 0
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
export async function deleteCredentialAccountForUser(
  db: PortableDb,
  userId: string
): Promise<void> {
  const accounts = authAccountsTable()
  // Matched on `providerId` only — never on the retired `issuer` column.
  // Better Auth's `admin.createUser` writes the throwaway credential row with
  // `issuer` NULL, so an `issuer` predicate would delete nothing: the accept
  // flow would then insert a SECOND credential row, and sign-in, which rejects
  // an ambiguous account key, would fail for the invited customer.
  await db
    .delete(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, 'credential')))
}

/**
 * Find a Better Auth user by id, as the accept flow reads it: `undefined` when
 * no account holds the id any more, removed between issuing and accepting (a rare race).
 */
export async function findUserById(
  db: PortableDb,
  userId: string
): Promise<InvitationUser | undefined> {
  const users = authUsersTable()
  const rows = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  return rows[0]
}
