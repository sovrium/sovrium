/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, asc, inArray, isNull, not, notInArray, or, sql } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import {
  UserDirectoryRepository,
  UserDirectoryDatabaseError,
  type UserDirectoryEntry,
  type UserDirectoryQuery,
} from '@/application/ports/repositories/auth/user-directory-repository'
import {
  authTeamMembersTable,
  authUsersTable,
} from '@/infrastructure/database/drizzle/dialect-schema'
import { Database } from '@/infrastructure/database/drizzle/layer'
import { notAnAgentAccount } from '@/infrastructure/database/sql/auth-user-predicates'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import { containsInsensitive } from '@/infrastructure/database/sql/dialect-sql-helpers'
import {
  isMissingUserAccessTable,
  userAccessTableSql,
} from '@/infrastructure/database/sql/user-access-rows'
import type { PortableDb } from '@/infrastructure/database/drizzle/db'
import type { Dialect } from '@/infrastructure/database/drizzle/layer'
import type { SQL } from 'drizzle-orm'

/** Wrap a DB promise, adapting failures to UserDirectoryDatabaseError. */
const wrap = makeDbWrap((error) => new UserDirectoryDatabaseError({ cause: error }))

/** The two exclusions every directory read applies: agent accounts and banned ones. */
function pickable(users: Readonly<ReturnType<typeof authUsersTable>>) {
  return [notAnAgentAccount(users.email), or(isNull(users.banned), not(users.banned))] as const
}

/** The query's id narrowing as a condition, or none when it narrows nothing. */
function amongIdsCondition(
  users: Readonly<ReturnType<typeof authUsersTable>>,
  ids: UserDirectoryQuery['ids']
) {
  if (ids === undefined || ids.ids.length === 0) return undefined
  const distinct = [...new Set(ids.ids)]
  return ids.within ? inArray(users.id, distinct) : notInArray(users.id, distinct)
}

/**
 * The query's audience narrowing as a condition — a stored role among the
 * reading roles, or a group membership when groups can widen — or none when it
 * narrows nothing. `false` when it admits no one.
 */
function audienceCondition(
  db: PortableDb,
  users: Readonly<ReturnType<typeof authUsersTable>>,
  audience: UserDirectoryQuery['audience']
) {
  if (audience === undefined) return undefined
  const teamMembers = authTeamMembersTable()
  const arms = [
    ...(audience.roles.length > 0 ? [inArray(users.role, [...new Set(audience.roles)])] : []),
    ...(audience.teamMembers
      ? [inArray(users.id, db.select({ id: teamMembers.userId }).from(teamMembers))]
      : []),
  ]
  return arms.length === 0 ? false : or(...arms)
}

/**
 * The query's scope narrowing as a condition — the account holds a
 * `user_access` assignment of a scope table naming at least one record that an
 * assignment of `scope.userId` on the same table names too — or none when it
 * narrows nothing. `false` when it admits no one.
 *
 * Postgres stores `record_ids` as `TEXT[]` and tests the overlap with `&&`;
 * SQLite stores a JSON array and expands both sides with `json_each`. Every
 * value is bound; the aliases are fixed identifiers.
 */
function scopeCondition(
  dialect: Dialect,
  users: Readonly<ReturnType<typeof authUsersTable>>,
  scope: UserDirectoryQuery['scope']
) {
  if (scope === undefined) return undefined
  const slugs = [...new Set(scope.tableSlugs)]
  if (slugs.length === 0) return false
  const table = userAccessTableSql(dialect)
  const peer = sql.identifier('directory_scope_peer')
  const self = sql.identifier('directory_scope_self')
  const col = (alias: typeof peer, name: string) => sql`${alias}.${sql.identifier(name)}`
  const shared = sql`${col(peer, 'user_id')} = ${users.id} AND ${col(self, 'user_id')} = ${scope.userId} AND ${col(peer, 'table_slug')} = ${col(self, 'table_slug')} AND ${col(peer, 'table_slug')} IN (${sql.join(
    slugs.map((slug) => sql`${slug}`),
    sql`, `
  )})`
  if (dialect.kind === 'sqlite') {
    const peerIds = sql.identifier('directory_scope_peer_ids')
    const selfIds = sql.identifier('directory_scope_self_ids')
    return sql`EXISTS (SELECT 1 FROM ${table} AS ${peer}, json_each(${col(peer, 'record_ids')}) AS ${peerIds}, ${table} AS ${self}, json_each(${col(self, 'record_ids')}) AS ${selfIds} WHERE ${shared} AND ${peerIds}.${sql.identifier('value')} = ${selfIds}.${sql.identifier('value')})`
  }
  return sql`EXISTS (SELECT 1 FROM ${table} AS ${peer}, ${table} AS ${self} WHERE ${shared} AND ${col(peer, 'record_ids')} && ${col(self, 'record_ids')})`
}

/**
 * The conditions a directory page adds to the pickable exclusions: the term,
 * the keyset cursor, the id, audience and scope narrowings — or `undefined`
 * when one of them admits no one.
 */
function pageConditions(
  { db, dialect }: { readonly db: PortableDb; readonly dialect: Dialect },
  users: Readonly<ReturnType<typeof authUsersTable>>,
  { term, after, ids, audience, scope }: UserDirectoryQuery
) {
  // Within no one is no one.
  if (ids?.within === true && ids.ids.length === 0) return undefined
  const narrowings = [audienceCondition(db, users, audience), scopeCondition(dialect, users, scope)]
  if (narrowings.includes(false)) return undefined
  // Keyset on the ORDER BY: strictly after `(lower(name), id)` of the previous
  // page's last entry. Both values are bound parameters.
  const afterCursor = after
    ? sql`(lower(${users.name}) > lower(${after.name}) OR (lower(${users.name}) = lower(${after.name}) AND ${users.id} > ${after.id}))`
    : undefined
  return [
    term ? containsInsensitive(users.name, term) : undefined,
    afterCursor,
    amongIdsCondition(users, ids),
    ...narrowings,
  ].filter((condition): condition is SQL => condition !== undefined && condition !== false)
}

function toEntry(row: {
  readonly id: unknown
  readonly name: string | null
  readonly image: string | null
}): UserDirectoryEntry {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    image: row.image ?? null,
  }
}

/**
 * User Directory Repository Implementation.
 *
 * One Drizzle query-builder select, shaped by three predicates:
 *
 *   - **not an agent** ({@link notAnAgentAccount}). AI agents are mirrored into
 *     the auth user table with `@agents.sovrium.local` addresses so they inherit
 *     RBAC. They are accounts, not people, and a naive directory leaks them into
 *     a human picker. The rule and its rationale now live in one shared module
 *     because two sibling admin reads went to the auth table directly and each
 *     had to remember it independently — one of them did not.
 *   - **not banned.** A banned account keeps its row; offering it as an assignee
 *     would name someone who can no longer act. `banned` is nullable, so the
 *     NULL arm is explicit — `not(banned)` alone would drop every account that
 *     never had the column written.
 *   - **matches the term**, when one was supplied.
 *   - **shares a scope record**, when the caller asks for it
 *     ({@link scopeCondition}): in an app declaring `auth.scopeTables`, a
 *     non-admin reader is listed only the accounts whose `user_access`
 *     assignments name a record of a scope table her own assignments name too.
 *     That is the app's own partition, read from its assignments — unlike the
 *     organization, which holds every account (below).
 *
 * There is deliberately no organization-membership filter, and that is a
 * stronger position than it looks. Sovrium is single-organization by
 * construction: the organization plugin sets
 * `allowUserToCreateOrganization: false`, the id is the hard-coded
 * `SOVRIUM_ORGANIZATION_ID`, and a `user.create.after` hook enrols every new
 * account. A scope filter is only a control if the scope can hold more than one
 * value. Worse, both enrolment paths swallow their failures non-fatally, so a
 * transient database hiccup during signup would leave an account with no
 * membership row — and a membership-scoped query would then make that person
 * **permanently invisible in every user picker, silently**. The failure mode of
 * the "safer" query is worse than the exposure it prevents, and a live-looking
 * `.where(eq(members.organizationId, …))` would read to a future reviewer as
 * tenant isolation that was considered and handled. It would be neither.
 *
 * Note also that organization scoping would NOT have caught the agent accounts:
 * agents are enrolled into the organization like everyone else, so a membership
 * filter returns them in full.
 *
 * `email` is never selected. See the port's {@link UserDirectoryEntry}.
 */
export const UserDirectoryRepositoryLive = Layer.effect(
  UserDirectoryRepository,
  Effect.map(Database, ({ client: db, dialect }) =>
    UserDirectoryRepository.of({
      listPickableUsers: (query) =>
        wrap(async (): Promise<readonly UserDirectoryEntry[]> => {
          const users = authUsersTable()
          const conditions = pageConditions({ db, dialect }, users, query)
          // A narrowing that admits no one is answered without touching the store.
          if (conditions === undefined) return []
          try {
            const rows = await db
              .select({ id: users.id, name: users.name, image: users.image })
              .from(users)
              .where(and(...pickable(users), ...conditions))
              .orderBy(asc(sql`lower(${users.name})`), asc(users.id))
              .limit(query.limit)
            return rows.map(toEntry)
          } catch (error) {
            // A scope narrowing over a store with no assignments table shares
            // no record with anyone, so it lists no one.
            if (query.scope !== undefined && isMissingUserAccessTable(error)) return []
            throw error
          }
        }),
      findPickableUsersByIds: (ids) =>
        wrap(async (): Promise<readonly UserDirectoryEntry[]> => {
          if (ids.length === 0) return []
          const users = authUsersTable()
          const rows = await db
            .select({ id: users.id, name: users.name, image: users.image })
            .from(users)
            .where(and(...pickable(users), inArray(users.id, [...new Set(ids)])))
          return rows.map(toEntry)
        }),
    })
  )
)
