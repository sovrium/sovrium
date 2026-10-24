/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Rebuilding the app's organisation in an `app/seed` reset, as every table the
 * reset rebuilds: from the config and the seed, not from what a visitor left.
 *
 * Every invitation goes, pending ones included. The teams are exactly the
 * groups the config declares — kept with their ids, the missing ones created —
 * and none has a member, since no seed file and no config writes one. Every
 * membership but the host administrators' own goes, and each kept account then
 * holds the membership a seed run gives a new account (the engine's
 * `ensureMembership`: `owner` for the first member, `member` after). The
 * organisation takes the app's name again; its id and slug are fixed.
 *
 * One transaction: a statement that fails leaves the organisation as it was.
 */

import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { db } from '@/infrastructure/database'
import { authTableRef } from '@/infrastructure/database/sql/dialect-sql'
import { runQuietly } from './seed-self-baseline'
import { authExists, isSqlite } from './seed-self-clear'
import { readAccounts } from './seed-self-kept'
import type { HostAdmin } from './seed-self-admins'
import type { App } from '@/domain/models/app'
import type { SeedAccount } from '@/domain/models/seed'
import type { RawSqlRunner } from '@/infrastructure/database/sql/dialect-execute'
import type { SQL } from 'drizzle-orm'

/**
 * The id of the app's one organisation (`SOVRIUM_ORGANIZATION_ID` in the auth
 * infrastructure, which the CLI may not import).
 */
const ORGANISATION_ID = 'sovrium-org'

const WHAT = 'reset could not rebuild the organisation'

type Runner = Readonly<RawSqlRunner>

const inTurn = <T>(items: readonly T[], step: (item: T) => Promise<unknown>): Promise<void> =>
  items.reduce<Promise<void>>(
    (previous, item) =>
      previous.then(async () => {
        await step(item)
      }),
    Promise.resolve()
  )

const list = (values: readonly string[]): SQL =>
  sql.join(
    values.map((value) => sql`${value}`),
    sql`, `
  )

const organisationExists = sql`EXISTS (SELECT 1 FROM ${authTableRef('organization')}
  WHERE id = ${ORGANISATION_ID})`

/** Keep the declared groups' teams, empty; remove every other team; create a missing one. */
const rebuildTeams = async (tx: Runner, groups: readonly string[], now: SQL): Promise<void> => {
  const teams = authTableRef('team')
  await runQuietly(tx, sql`DELETE FROM ${authTableRef('team_member')}`, WHAT)
  await runQuietly(
    tx,
    groups.length === 0
      ? sql`DELETE FROM ${teams}`
      : sql`DELETE FROM ${teams} WHERE name NOT IN (${list(groups)})`,
    WHAT
  )
  await runQuietly(tx, sql`UPDATE ${teams} SET member_count = 0`, WHAT)
  await inTurn(groups, (name) =>
    runQuietly(
      tx,
      sql`INSERT INTO ${teams} (id, name, organization_id, member_count, created_at, updated_at)
          SELECT ${randomUUID()}, ${name}, ${ORGANISATION_ID}, 0, ${now}, ${now}
          WHERE ${organisationExists}
            AND NOT EXISTS (SELECT 1 FROM ${teams} WHERE name = ${name})`,
      WHAT
    )
  )
}

/** Remove every membership but the host administrators', then give each kept account its own. */
const rebuildMemberships = async (
  tx: Runner,
  members: readonly string[],
  admins: readonly HostAdmin[],
  now: SQL
): Promise<void> => {
  const table = authTableRef('member')
  const adminIds = admins.map((admin) => admin.id)
  await runQuietly(
    tx,
    adminIds.length === 0
      ? sql`DELETE FROM ${table}`
      : sql`DELETE FROM ${table} WHERE user_id NOT IN (${list(adminIds)})`,
    WHAT
  )
  await inTurn(members, (userId) =>
    runQuietly(
      tx,
      sql`INSERT INTO ${table} (id, organization_id, user_id, role, created_at)
          SELECT ${randomUUID()}, ${ORGANISATION_ID}, ${userId},
                 CASE WHEN EXISTS (SELECT 1 FROM ${table} WHERE organization_id = ${ORGANISATION_ID})
                      THEN 'member' ELSE 'owner' END,
                 ${now}
          WHERE ${organisationExists}
            AND NOT EXISTS (SELECT 1 FROM ${table} WHERE user_id = ${userId})`,
      WHAT
    )
  )
}

/**
 * Rebuild the organisation from the config and the seed: no invitation, the
 * declared groups' teams with no member, the host administrators' memberships
 * kept and each listed account that exists a member as a seed run makes it.
 * An account the seed creates afterwards is made a member by the engine as it
 * is created. Nothing to do for an app with no organisation tables.
 */
export const rebuildOrganisation = async (
  app: Readonly<App>,
  listed: readonly SeedAccount[],
  admins: readonly HostAdmin[]
): Promise<void> => {
  if (!(await authExists('organization'))) return
  const addresses = listed.map((account) => account.email.toLowerCase())
  const ids = new Map((await readAccounts()).map((account) => [account.email, account.id]))
  const members = [
    ...new Set([
      ...admins.map((admin) => admin.id),
      ...addresses.flatMap((email) => {
        const id = ids.get(email)
        return id === undefined ? [] : [id]
      }),
    ]),
  ]
  const groups = (app.auth?.groups ?? []).map((group) => group.name)
  const now = isSqlite() ? sql`${Date.now()}` : sql`now()`
  await db.transaction(async (tx) => {
    await runQuietly(tx, sql`DELETE FROM ${authTableRef('invitation')}`, WHAT)
    await rebuildTeams(tx, groups, now)
    await rebuildMemberships(tx, members, admins, now)
    await runQuietly(
      tx,
      sql`UPDATE ${authTableRef('organization')} SET name = ${app.name}
          WHERE id = ${ORGANISATION_ID}`,
      WHAT
    )
  })
}
