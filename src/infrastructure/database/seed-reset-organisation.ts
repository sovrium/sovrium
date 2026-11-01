/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Rebuilding the app's organisation in a reset of the app to its seed, as
 * every table the reset rebuilds: from the config and the seed, not from what
 * a visitor left.
 *
 * Every invitation goes, pending ones included. The teams are exactly the
 * groups the config declares — kept with their ids, the missing ones created —
 * and none has a member, since no seed file and no config writes one. Every
 * membership but the host administrators' own goes, and each kept account then
 * holds the membership the caller decided for it. The organisation takes the
 * app's name again; its id and slug are fixed.
 *
 * One transaction: a statement that fails leaves the organisation as it was.
 */

import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { withPromiseTransaction } from '@/infrastructure/database/transaction'
import { boundList, inTurn, runQuietly, storedNow, type ResetOn } from './seed-reset-statements'
import type { OrganisationRebuild } from '@/application/ports/repositories/seed/seed-reset-repository'
import type { DatabaseService, Dialect } from '@/infrastructure/database/drizzle/layer'
import type { SQL } from 'drizzle-orm'
import type { Effect } from 'effect'

/** The id of the app's one organisation (`SOVRIUM_ORGANIZATION_ID` in the auth infrastructure). */
const ORGANISATION_ID = 'sovrium-org'

const WHAT = 'reset could not rebuild the organisation'

const organisationExists = (
  dialect: Dialect
): SQL => sql`EXISTS (SELECT 1 FROM ${dialect.sql.authTableRef('organization')}
  WHERE id = ${ORGANISATION_ID})`

/** Keep the declared groups' teams, empty; remove every other team; create a missing one. */
const rebuildTeams = async ({ tx, dialect }: ResetOn, groups: readonly string[], now: SQL) => {
  const teams = dialect.sql.authTableRef('team')
  await runQuietly(
    { tx, dialect },
    sql`DELETE FROM ${dialect.sql.authTableRef('team_member')}`,
    WHAT
  )
  await runQuietly(
    { tx, dialect },
    groups.length === 0
      ? sql`DELETE FROM ${teams}`
      : sql`DELETE FROM ${teams} WHERE name NOT IN (${boundList(groups)})`,
    WHAT
  )
  await runQuietly({ tx, dialect }, sql`UPDATE ${teams} SET member_count = 0`, WHAT)
  await inTurn(groups, (name) =>
    runQuietly(
      { tx, dialect },
      sql`INSERT INTO ${teams} (id, name, organization_id, member_count, created_at, updated_at)
          SELECT ${randomUUID()}, ${name}, ${ORGANISATION_ID}, 0, ${now}, ${now}
          WHERE ${organisationExists(dialect)}
            AND NOT EXISTS (SELECT 1 FROM ${teams} WHERE name = ${name})`,
      WHAT
    )
  )
}

/** Remove every membership but the host administrators', then give each kept account its own. */
const rebuildMemberships = async (
  { tx, dialect }: ResetOn,
  roles: ReadonlyMap<string, 'owner' | 'member'>,
  adminIds: readonly string[],
  now: SQL
) => {
  const table = dialect.sql.authTableRef('member')
  await runQuietly(
    { tx, dialect },
    adminIds.length === 0
      ? sql`DELETE FROM ${table}`
      : sql`DELETE FROM ${table} WHERE user_id NOT IN (${boundList(adminIds)})`,
    WHAT
  )
  await inTurn([...roles], ([userId, role]) =>
    runQuietly(
      { tx, dialect },
      sql`INSERT INTO ${table} (id, organization_id, user_id, role, created_at)
          SELECT ${randomUUID()}, ${ORGANISATION_ID}, ${userId}, ${role}, ${now}
          WHERE ${organisationExists(dialect)}
            AND NOT EXISTS (SELECT 1 FROM ${table} WHERE user_id = ${userId})`,
      WHAT
    )
  )
}

/**
 * Rebuild the organisation: no invitation, the declared groups' teams with no
 * member, the host administrators' memberships kept and each kept account a
 * member as `rebuild.roles` makes it.
 */
export const rebuildOrganisation = <E>(
  database: DatabaseService,
  rebuild: OrganisationRebuild,
  onFailure: (error: unknown) => E
): Effect.Effect<void, E> => {
  const { dialect } = database
  const now = storedNow(dialect)
  return withPromiseTransaction(
    database.client,
    async (tx) => {
      await runQuietly(
        { tx, dialect },
        sql`DELETE FROM ${dialect.sql.authTableRef('invitation')}`,
        WHAT
      )
      await rebuildTeams({ tx, dialect }, rebuild.groups, now)
      await rebuildMemberships({ tx, dialect }, rebuild.roles, rebuild.adminIds, now)
      await runQuietly(
        { tx, dialect },
        sql`UPDATE ${dialect.sql.authTableRef('organization')} SET name = ${rebuild.appName}
            WHERE id = ${ORGANISATION_ID}`,
        WHAT
      )
    },
    onFailure
  )
}
