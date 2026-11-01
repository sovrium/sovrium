/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The contact reads of the `AuthRepository`: an account's email, its name
 * and email, or its name and avatar, by id — singly, or for many ids in one query. Each is built over
 * the client of the `Database` the repository reads.
 */

import { eq, inArray, sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { AuthDatabaseError } from '@/application/ports/repositories/auth/auth-repository'
import { authUsersTable } from '@/infrastructure/database/drizzle/dialect-schema'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import type { PortableDb } from '@/infrastructure/database'

/** Wrap a DB promise, adapting failures to AuthDatabaseError. */
const wrap = makeDbWrap((error) => new AuthDatabaseError({ cause: error }))

/** The email of each of `userIds`, in one query, keyed by user id. */
export const findUserEmailsByIds = (db: PortableDb) => (userIds: readonly string[]) =>
  Effect.gen(function* () {
    const wanted = [...new Set(userIds)]
    if (wanted.length === 0) return new Map<string, string>()
    const rows = yield* wrap(async () => {
      const users = authUsersTable()
      return await db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(inArray(users.id, wanted))
    })
    return new Map(
      rows.filter((row) => row.email !== '').map((row) => [row.id, row.email] as const)
    )
  })

/** An account's display name and email, by id. */
export const findUserContactById = (db: PortableDb) => (userId: string) =>
  Effect.gen(function* () {
    const result = yield* wrap(async () => {
      const users = authUsersTable()
      return await db
        .select({ name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
    })
    const row = result[0]
    return row === undefined ? undefined : { name: row.name ?? '', email: row.email }
  })

/** An account's name and avatar, by id, as stored. */
export const findUserProfileById = (db: PortableDb) => (userId: string) =>
  Effect.gen(function* () {
    const result = yield* wrap(async () => {
      const users = authUsersTable()
      return await db
        .select({ name: users.name, image: users.image })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
    })
    const row = result[0]
    return row === undefined ? undefined : { name: row.name ?? null, image: row.image ?? null }
  })

/** The display name and email of each of `userIds`, in one query, keyed by user id. */
export const findUserContactsByIds = (db: PortableDb) => (userIds: readonly string[]) =>
  Effect.gen(function* () {
    const wanted = [...new Set(userIds)]
    if (wanted.length === 0) return new Map<string, { name: string; email: string }>()
    const rows = yield* wrap(async () => {
      const users = authUsersTable()
      return await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(inArray(users.id, wanted))
    })
    return new Map(
      rows
        .filter((row) => row.email !== '')
        .map((row) => [row.id, { name: row.name ?? '', email: row.email }] as const)
    )
  })

/** An account's email, by id. */
export const findUserEmailById = (db: PortableDb) => (userId: string) =>
  Effect.gen(function* () {
    const result = yield* wrap(async () => {
      const users = authUsersTable()
      return await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
    })

    return result[0]?.email ?? undefined
  })

/**
 * The account id of each of `emails`, matched without regard to case, keyed by
 * the lowercased address.
 */
export const findUserIdsByEmails = (db: PortableDb) => (emails: readonly string[]) =>
  Effect.gen(function* () {
    const wanted = [...new Set(emails.map((email) => email.trim().toLowerCase()))].filter(
      (email) => email !== ''
    )
    if (wanted.length === 0) return new Map<string, string>()
    const rows = yield* wrap(async () => {
      const users = authUsersTable()
      return await db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(inArray(sql`lower(${users.email})`, wanted))
    })
    return new Map(rows.map((row) => [row.email.toLowerCase(), row.id] as const))
  })
