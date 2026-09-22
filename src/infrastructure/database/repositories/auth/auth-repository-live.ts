/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, asc, count, countDistinct, eq, inArray, isNull, or } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import {
  AuthRepository,
  AuthDatabaseError,
} from '@/application/ports/repositories/auth/auth-repository'
import { db } from '@/infrastructure/database'
import {
  authUsersTable,
  authSessionsTable,
  authAccountsTable,
  authTeamsTable,
  authTeamMembersTable,
} from '@/infrastructure/database/drizzle/dialect-schema'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'

/** Wrap a DB promise, adapting failures to AuthDatabaseError. */
const wrap = makeDbWrap((error) => new AuthDatabaseError({ cause: error }))

/**
 * Auth Repository Implementation
 *
 * Provides database operations for auth-related user management.
 * Methods operate on the Better Auth `user` and `session` tables via Drizzle
 * ORM. The table objects are resolved per-dialect (`authUsersTable()` /
 * `authSessionsTable()`) so a query targets `auth.user` on PostgreSQL and the
 * flat `auth_user` on SQLite (which has no schemas).
 */
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

  getUserRoles: (userIds: readonly string[]) =>
    Effect.gen(function* () {
      // Short-circuit before the pool is touched. An empty roster is reachable
      // from every caller (a connection nobody has authorized, an app with no
      // agents), and the answer is knowable without asking — so an empty `IN
      // ()`, a shape worth not relying on across two dialects, never gets
      // built.
      if (userIds.length === 0) return new Map<string, string>()

      const rows = yield* wrap(async () => {
        const users = authUsersTable()
        return await db
          .select({ id: users.id, role: users.role })
          .from(users)
          .where(inArray(users.id, [...userIds]))
      })

      // A NULL `role` is dropped rather than mapped to a default, so this
      // agrees exactly with `getUserRole` returning `undefined` — the caller
      // decides what an unset role means, in one place, for both forms.
      return new Map(
        rows
          .filter((row): row is { id: string; role: string } => typeof row.role === 'string')
          .map((row) => [row.id, row.role] as const)
      )
    }),

  updateUserRole: (userId: string, role: string) =>
    wrap(() => {
      const users = authUsersTable()
      return db.update(users).set({ role }).where(eq(users.id, userId))
    }).pipe(Effect.asVoid),

  userExists: (userId: string) =>
    Effect.gen(function* () {
      const rows = yield* wrap(async () => {
        const users = authUsersTable()
        return await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1)
      })
      return rows.length > 0
    }),

  findUserRole: (userId: string) =>
    Effect.gen(function* () {
      const rows = yield* wrap(() => {
        const users = authUsersTable()
        return db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1)
      })
      const row = rows[0]
      // An ABSENT row and a NULL role are different answers — see the port's
      // doc comment. `rows[0]` is already `undefined` for the former and
      // `{ role: null }` for the latter, so the projection carries the
      // distinction without a second read.
      return row
    }),

  banUser: (userId: string, reason?: string) =>
    wrap(() => {
      const users = authUsersTable()
      return db
        .update(users)
        .set(reason === undefined ? { banned: true } : { banned: true, banReason: reason })
        .where(eq(users.id, userId))
    }).pipe(Effect.asVoid),

  unbanUser: (userId: string) =>
    wrap(() => {
      const users = authUsersTable()
      // Drizzle requires an explicit `null` to issue `SET ban_reason = NULL`;
      // `undefined` would omit the column and leave the stale reason behind.
      // eslint-disable-next-line unicorn/no-null
      return db.update(users).set({ banned: false, banReason: null }).where(eq(users.id, userId))
    }).pipe(Effect.asVoid),

  // Groups are Better Auth "teams": a membership is a `team_member` row linking
  // `user.id` to `team.id`. The INNER JOIN projects the team NAME, which is the
  // un-prefixed Sovrium group name that permission evaluation compares against.
  getUserGroups: (userId: string) =>
    Effect.gen(function* () {
      const rows = yield* wrap(async () => {
        const teams = authTeamsTable()
        const teamMembers = authTeamMembersTable()
        return await db
          .select({ name: teams.name })
          .from(teamMembers)
          .innerJoin(teams, eq(teamMembers.teamId, teams.id))
          .where(eq(teamMembers.userId, userId))
      })
      return rows.map((row) => row.name)
    }),

  findAdminEmails: (adminRole: string) =>
    Effect.gen(function* () {
      const rows = yield* wrap(async () => {
        const users = authUsersTable()
        return await db.select({ email: users.email }).from(users).where(eq(users.role, adminRole))
      })
      return rows
        .map((row) => row.email)
        .filter((email): email is string => typeof email === 'string' && email !== '')
    }),

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

  countUsers: Effect.gen(function* () {
    const rows = yield* wrap(async () => {
      const users = authUsersTable()
      return await db.select({ value: count() }).from(users)
    })
    return Number(rows[0]?.value ?? 0)
  }),

  // Count only sign-in-capable (human) users — those with at least one
  // `auth.account` row. Synthetic agent users (mirrored from `app.agents[]`,
  // `type='agent'`) carry NO account row, so an INNER JOIN on accounts
  // excludes them. `countDistinct(users.id)` collapses the (rare) multi-account
  // user to a single count. Dialect-portable: it relies only on the always-
  // present `account.user_id` FK, never on the lazily-added `user.type` column.
  countHumanUsers: Effect.gen(function* () {
    const rows = yield* wrap(async () => {
      const users = authUsersTable()
      const accounts = authAccountsTable()
      return await db
        .select({ value: countDistinct(users.id) })
        .from(users)
        .innerJoin(accounts, eq(accounts.userId, users.id))
    })
    return Number(rows[0]?.value ?? 0)
  }),

  findFirstAdmin: (adminRole: string) =>
    Effect.gen(function* () {
      const result = yield* wrap(async () => {
        const users = authUsersTable()
        return await db
          .select({ email: users.email })
          .from(users)
          .where(eq(users.role, adminRole))
          .orderBy(asc(users.id))
          .limit(1)
      })
      const first = result[0]
      return first ? { email: first.email } : undefined
    }),

  // Count the ACTIVE admins — those holding one of `adminRoles` whose account
  // is not banned. `or(isNull(banned), eq(banned, false))` (never
  // `ne(banned, true)`, which silently drops NULL rows in both dialects) is
  // what makes the ban-then-demote lockout route observable: a banned admin
  // still carries `role='admin'` but cannot sign in.
  countActiveAdmins: (adminRoles: readonly string[]) =>
    Effect.gen(function* () {
      if (adminRoles.length === 0) return 0
      const rows = yield* wrap(async () => {
        const users = authUsersTable()
        return await db
          .select({ value: count() })
          .from(users)
          .where(
            and(
              inArray(users.role, [...adminRoles]),
              or(isNull(users.banned), eq(users.banned, false))
            )
          )
      })
      return Number(rows[0]?.value ?? 0)
    }),
})
