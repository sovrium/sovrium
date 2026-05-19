/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, eq, like } from 'drizzle-orm'
import { db } from '@/infrastructure/database'
import { accounts, users, verifications } from './schema'

export const INVITATION_IDENTIFIER_PREFIX = 'invitation:'

export const buildInvitationIdentifier = (token: string): string =>
  `${INVITATION_IDENTIFIER_PREFIX}${token}`

export interface InvitationTokenRow {
  readonly id: string
  readonly token: string
  readonly userId: string
  readonly expiresAt: Date
}

export async function insertInvitationToken(params: {
  readonly id: string
  readonly token: string
  readonly userId: string
  readonly expiresAt: Date
}): Promise<void> {
  await db.insert(verifications).values({
    id: params.id,
    identifier: buildInvitationIdentifier(params.token),
    value: params.userId,
    expiresAt: params.expiresAt,
  })
}

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

export async function deleteInvitationToken(id: string): Promise<void> {
  await db.delete(verifications).where(eq(verifications.id, id))
}

export async function deletePendingInvitationsForUser(userId: string): Promise<void> {
  await db
    .delete(verifications)
    .where(
      and(
        like(verifications.identifier, `${INVITATION_IDENTIFIER_PREFIX}%`),
        eq(verifications.value, userId)
      )
    )
}

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

export async function userHasCredentialPassword(userId: string): Promise<boolean> {
  const rows = await db
    .select({ password: accounts.password })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, 'credential')))
    .limit(1)
  const row = rows[0]
  return Boolean(row?.password)
}

export async function insertCredentialAccount(params: {
  readonly id: string
  readonly userId: string
  readonly hashedPassword: string
}): Promise<void> {
  await db.insert(accounts).values({
    id: params.id,
    accountId: params.userId,
    providerId: 'credential',
    userId: params.userId,
    password: params.hashedPassword,
  })
}

export async function markUserEmailVerified(userId: string): Promise<void> {
  await db.update(users).set({ emailVerified: true }).where(eq(users.id, userId))
}

export async function deleteCredentialAccountForUser(userId: string): Promise<void> {
  await db
    .delete(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, 'credential')))
}

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
