/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The contact reads of the `AuthRepository`: an account's email, or its name
 * and email, by id — singly, or for many ids in one query.
 */

import { eq, inArray } from 'drizzle-orm'
import { Effect } from 'effect'
import { AuthDatabaseError } from '@/application/ports/repositories/auth/auth-repository'
import { db } from '@/infrastructure/database'
import { authUsersTable } from '@/infrastructure/database/drizzle/dialect-schema'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'

/** Wrap a DB promise, adapting failures to AuthDatabaseError. */
const wrap = makeDbWrap((error) => new AuthDatabaseError({ cause: error }))

/** The email of each of `userIds`, in one query, keyed by user id. */
export const findUserEmailsByIds = (userIds: readonly string[]) =>
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
export const findUserContactById = (userId: string) =>
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

/** The display name and email of each of `userIds`, in one query, keyed by user id. */
export const findUserContactsByIds = (userIds: readonly string[]) =>
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
