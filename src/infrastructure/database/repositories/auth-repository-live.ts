/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { eq } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import { AuthRepository, AuthDatabaseError } from '@/application/ports/repositories/auth-repository'
import { db } from '@/infrastructure/database'
import { authUsersTable, authSessionsTable } from '@/infrastructure/database/drizzle/dialect-schema'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'

const wrap = makeDbWrap((error) => new AuthDatabaseError({ cause: error }))

export const AuthRepositoryLive = Layer.succeed(AuthRepository, {
  verifyUserEmail: (userId: string) =>
    wrap(() => {
      const users = authUsersTable()
      return db.update(users).set({ emailVerified: true }).where(eq(users.id, userId))
    }).pipe(Effect.asVoid),

  findUserEmailById: (userId: string) =>
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
    }),

  getUserRole: (userId: string) =>
    Effect.gen(function* () {
      const result = yield* wrap(async () => {
        const users = authUsersTable()
        return await db
          .select({ role: users.role })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1)
      })

      return result[0]?.role ?? undefined
    }),

  updateUserRole: (userId: string, role: string) =>
    wrap(() => {
      const users = authUsersTable()
      return db.update(users).set({ role }).where(eq(users.id, userId))
    }).pipe(Effect.asVoid),

  getUserSessionToken: (userId: string) =>
    Effect.gen(function* () {
      const result = yield* wrap(async () => {
        const sessions = authSessionsTable()
        return await db
          .select({ token: sessions.token })
          .from(sessions)
          .where(eq(sessions.userId, userId))
          .limit(1)
      })

      return result[0]?.token ?? undefined
    }),
})
