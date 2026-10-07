/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, asc, count, countDistinct, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import {
  AuthRepository,
  AuthDatabaseError,
} from '@/application/ports/repositories/auth/auth-repository'
import { redactEmail } from '@/domain/kernel/sanitize/email-redaction'
import { isBanInForce } from '@/domain/models/app/auth/ban-standing-service'
import { db } from '@/infrastructure/database'
import {
  authUsersTable,
  authSessionsTable,
  authAccountsTable,
  authTeamsTable,
  authTeamMembersTable,
} from '@/infrastructure/database/drizzle/dialect-schema'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'

/**
 * The most accounts one `getUserDisplayLabels` call names. A page of records is
 * at most 100 rows, so this is only reached by multi-user values; it keeps the
 * `IN (...)` far below both dialects' bound-parameter ceilings.
 */
const MAX_LABELLED_ACCOUNTS = 1000

/**
 * The label a read surface prints for an account: its name, or its email when
 * the name is blank — never empty for an account that exists.
 */
const accountLabel = (row: { readonly name: string | null; readonly email: string }): string => {
  const name = typeof row.name === 'string' ? row.name.trim() : ''
  return name.length > 0 ? name : row.email
}

/**
 * The label the account DIRECTORY prints: the name, or — for an account with
 * none — its email with the mailbox masked. The picker lists every account to
 * every signed-in visitor, unlike a read surface, which labels only the
 * accounts a record the reader may see already references; an app open to
 * sign-up would otherwise publish its users' addresses to each of them.
 */
const directoryLabel = (row: { readonly name: string | null; readonly email: string }): string => {
  const name = typeof row.name === 'string' ? row.name.trim() : ''
  return name.length > 0 ? name : redactEmail(row.email)
}

/** Wrap a DB promise, adapting failures to AuthDatabaseError. */
const wrap = makeDbWrap((error) => new AuthDatabaseError({ cause: error }))

/**
 * Auth Repository Implementation: the Better Auth `user` and `session` tables,
 * resolved per dialect — `auth.user` on PostgreSQL, the flat `auth_user` on SQLite.
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

  findUserEmailsByIds: (userIds: readonly string[]) =>
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
    }),

  findUserIdsByEmails: (emails: readonly string[]) =>
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
    }),

  findUserContactById: (userId: string) =>
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

  getUserDisplayLabels: (userIds: readonly string[]) =>
    Effect.gen(function* () {
      // Deduplicated and capped: one bound parameter per id, so an unbounded
      // list (a page of multi-user values) could exceed the driver's parameter
      // ceiling. An id past the cap simply keeps printing its stored key.
      const ids = [...new Set(userIds)].slice(0, MAX_LABELLED_ACCOUNTS)
      if (ids.length === 0) return new Map<string, string>()
      const rows = yield* wrap(async () => {
        const users = authUsersTable()
        return await db
          .select({ id: users.id, name: users.name, email: users.email })
          .from(users)
          .where(inArray(users.id, ids))
      })
      // A blank name falls back to the email, so the label is never empty for
      // an account that exists.
      return new Map(rows.map((row) => [row.id, accountLabel(row)] as const))
    }),

  listAccountChoices: (limit: number) =>
    Effect.gen(function* () {
      const bound = Math.max(0, Math.min(limit, MAX_LABELLED_ACCOUNTS))
      if (bound === 0) return []
      const rows = yield* wrap(async () => {
        const users = authUsersTable()
        return await db
          .select({ id: users.id, name: users.name, email: users.email })
          .from(users)
          .orderBy(asc(users.name), asc(users.email))
          .limit(bound)
      })
      return rows
        .map((row) => ({ id: row.id, label: directoryLabel(row) }))
        .toSorted((a, b) => a.label.localeCompare(b.label))
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

  isActiveUser: (userId: string) =>
    Effect.gen(function* () {
      const rows = yield* wrap(async () => {
        const users = authUsersTable()
        return await db
          .select({ banned: users.banned, banExpires: users.banExpires })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1)
      })
      const row = rows[0]
      if (row === undefined) return false
      // A ban with an expiry that has passed no longer holds (Better Auth lifts it the same way).
      return !isBanInForce(row.banned, row.banExpires)
    }),

  // `rows[0]` is `undefined` for an absent row and `{ role: null }` for a NULL
  // role: the two answers the port keeps apart, without a second read.
  findUserRole: (userId: string) =>
    wrap(() => {
      const users = authUsersTable()
      return db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1)
    }).pipe(Effect.map((rows) => rows[0])),

  findSessionSignInMethod: (sessionId: string) =>
    wrap(() => {
      const sessions = authSessionsTable()
      return db
        .select({ signInMethod: sessions.signInMethod })
        .from(sessions)
        .where(eq(sessions.id, sessionId))
        .limit(1)
    }).pipe(Effect.map((rows) => rows[0]?.signInMethod ?? undefined)),

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
      return db.update(users).set({ banned: false, banReason: null }).where(eq(users.id, userId))
    }).pipe(Effect.asVoid),

  findUserBanState: (userId: string) =>
    Effect.gen(function* () {
      const rows = yield* wrap(async () => {
        const users = authUsersTable()
        return await db
          .select({ banned: users.banned, banReason: users.banReason })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1)
      })
      const row = rows[0]
      return row === undefined
        ? undefined
        : { banned: row.banned === true, banReason: row.banReason ?? null }
    }),

  restoreUserBanState: (userId: string, state) =>
    wrap(() => {
      const users = authUsersTable()
      return db
        .update(users)
        .set({ banned: state.banned, banReason: state.banReason })
        .where(eq(users.id, userId))
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

  getUsersGroups: (userIds: readonly string[]) =>
    Effect.gen(function* () {
      const ids = [...new Set(userIds)]
      if (ids.length === 0) return new Map<string, readonly string[]>()
      const rows = yield* wrap(async () => {
        const teams = authTeamsTable()
        const teamMembers = authTeamMembersTable()
        return await db
          .select({ userId: teamMembers.userId, name: teams.name })
          .from(teamMembers)
          .innerJoin(teams, eq(teamMembers.teamId, teams.id))
          .where(inArray(teamMembers.userId, ids))
      })
      return new Map(
        [...Map.groupBy(rows, (row) => row.userId)].map(
          ([userId, memberships]) => [userId, memberships.map((row) => row.name)] as const
        )
      )
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

  // Operator-email recipients: admin-tier, not banned (same NULL rule as
  // `countActiveAdmins`), and the named preference still on. Both preference
  // columns are NOT NULL DEFAULT true, so no NULL arm is needed there.
  findNotificationRecipients: ({ roles, preference }) =>
    Effect.gen(function* () {
      if (roles.length === 0) return [] as readonly string[]
      const rows = yield* wrap(async () => {
        const users = authUsersTable()
        const column =
          preference === 'automationAlerts'
            ? users.notifyAutomationAlerts
            : users.notifyWeeklyDigest
        return await db
          .select({ email: users.email })
          .from(users)
          .where(
            and(
              inArray(users.role, [...roles]),
              or(isNull(users.banned), eq(users.banned, false)),
              eq(column, true)
            )
          )
          .orderBy(asc(users.email))
      })
      return rows
        .map((row) => row.email)
        .filter((email): email is string => typeof email === 'string' && email !== '')
    }),
})
