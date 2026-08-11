/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, asc, isNull, not, or, sql } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  UserDirectoryRepository,
  UserDirectoryDatabaseError,
  type UserDirectoryEntry,
} from '@/application/ports/repositories/auth/user-directory-repository'
import { db } from '@/infrastructure/database'
import { authUsersTable } from '@/infrastructure/database/drizzle/dialect-schema'
import { notAnAgentAccount } from '@/infrastructure/database/sql/auth-user-predicates'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import { containsInsensitive } from '@/infrastructure/database/sql/dialect-sql-helpers'

/** Wrap a DB promise, adapting failures to UserDirectoryDatabaseError. */
const wrap = makeDbWrap((error) => new UserDirectoryDatabaseError({ cause: error }))

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
export const UserDirectoryRepositoryLive = Layer.succeed(UserDirectoryRepository, {
  listPickableUsers: ({ term, limit }) =>
    wrap(async (): Promise<readonly UserDirectoryEntry[]> => {
      const users = authUsersTable()

      const notAnAgent = notAnAgentAccount(users.email)
      const notBanned = or(isNull(users.banned), not(users.banned))
      const matchesTerm = term ? containsInsensitive(users.name, term) : undefined

      const rows = await db
        .select({ id: users.id, name: users.name, image: users.image })
        .from(users)
        .where(and(notAnAgent, notBanned, ...(matchesTerm ? [matchesTerm] : [])))
        .orderBy(asc(sql`lower(${users.name})`), asc(users.id))
        .limit(limit)

      return rows.map((row) => ({
        id: String(row.id),
        name: String(row.name ?? ''),
        // eslint-disable-next-line unicorn/no-null -- public wire contract: `image` is nullable, and JSON drops `undefined` entirely
        image: row.image ?? null,
      }))
    }),
})
