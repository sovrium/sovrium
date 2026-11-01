/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The accounts and app tables a reset of the app to its seed reads and writes:
 * every account by address, the host's administrators, an account's name,
 * role and password, the erasure of an account the seed does not list, and
 * the emptying of the app's own tables.
 *
 * The host's administrators are host configuration, not app data: the account
 * `AUTH_ADMIN_EMAIL` names, and the account whose Sovrium Cloud link carries
 * `SOVRIUM_PLATFORM_SSO_ADMIN_SUBJECT` — one account or two. A reset that
 * removed them would leave the operator of a demo locked out of the console
 * the morning after, since the server creates its first admin only on an empty
 * database. Each keeps its id, its sign-in rows and the admin role; only its
 * sessions go, like everyone's.
 */

import { hashPassword } from 'better-auth/crypto'
import { sql } from 'drizzle-orm'
import {
  PLATFORM_SSO_PROVIDER_ID,
  SOVRIUM_PLATFORM_SSO_ADMIN_SUBJECT_VAR,
} from '@/domain/models/process-env/platform-sso'
import { purgeAccount } from '@/infrastructure/database/account-purge'
import { resolvePurgeTableAuthorship } from '@/infrastructure/database/account-purge-authorship'
import { liveErasureSeams } from '@/infrastructure/database/account-purge-objects'
import { executeRawOn } from '@/infrastructure/database/sql/dialect-execute'
import { tableIdentifier } from '@/infrastructure/database/table-queries/statement/validation'
import { boundList, describeFailure } from './seed-reset-statements'
import type {
  HostAdmin,
  RecordedBaseline,
  ResetAccount,
} from '@/application/ports/repositories/seed/seed-reset-repository'
import type { App } from '@/domain/models/app'
import type { DatabaseService } from '@/infrastructure/database/drizzle/layer'

const accountsOf = (rows: readonly Record<string, unknown>[]): readonly ResetAccount[] =>
  rows.flatMap((row) =>
    typeof row.email === 'string' ? [{ id: String(row.id), email: row.email.toLowerCase() }] : []
  )

/** Every account, with its id and lower-cased email. */
export const readAccounts = async (database: DatabaseService): Promise<readonly ResetAccount[]> =>
  accountsOf(
    await executeRawOn(
      database.dialect.kind,
      database.client,
      sql`SELECT id, email FROM ${database.dialect.sql.authTableRef('user')}`
    )
  )

const setting = (name: string): string | undefined => {
  const value = Bun.env[name]?.trim()
  return value === undefined || value === '' ? undefined : value
}

/**
 * The account `AUTH_ADMIN_EMAIL` names. A baseline recorded with that address
 * wins over the address the account holds now: a visitor who changed the
 * shared account's email must not make it a stranger the reset erases, nor let
 * an account signed up with the freed address take its place.
 */
const namedAdmin = async (
  database: DatabaseService,
  email: string,
  baselines: ReadonlyMap<string, RecordedBaseline>
): Promise<readonly ResetAccount[]> => {
  const recorded = [...baselines.values()].filter((baseline) => baseline.email === email)
  const recognised = await recorded.reduce<Promise<readonly string[]>>(
    async (previous, baseline) => {
      const found = await executeRawOn(
        database.dialect.kind,
        database.client,
        sql`SELECT id FROM ${database.dialect.sql.authTableRef('user')} WHERE id = ${baseline.userId}`
      )
      return found.length > 0 ? [...(await previous), baseline.userId] : previous
    },
    Promise.resolve([])
  )
  if (recognised.length > 0) return recognised.map((id) => ({ id, email }))
  return accountsOf(
    await executeRawOn(
      database.dialect.kind,
      database.client,
      sql`SELECT id, email FROM ${database.dialect.sql.authTableRef('user')} WHERE lower(email) = ${email}`
    )
  )
}

/**
 * The host's administrators that exist in the database; none when neither
 * variable is set. `baselines` are the recorded ones, by which an
 * administrator whose address was changed is still recognised.
 */
export const readHostAdmins = async (
  database: DatabaseService,
  baselines: ReadonlyMap<string, RecordedBaseline>
): Promise<readonly HostAdmin[]> => {
  const email = setting('AUTH_ADMIN_EMAIL')?.toLowerCase()
  const subject = setting(SOVRIUM_PLATFORM_SSO_ADMIN_SUBJECT_VAR)
  const named = email === undefined ? [] : await namedAdmin(database, email, baselines)
  const bound =
    subject === undefined
      ? []
      : accountsOf(
          await executeRawOn(
            database.dialect.kind,
            database.client,
            sql`SELECT u.id, u.email FROM ${database.dialect.sql.authTableRef('user')} u
                JOIN ${database.dialect.sql.authTableRef('account')} a ON a.user_id = u.id
                WHERE a.provider_id = ${PLATFORM_SSO_PROVIDER_ID} AND a.account_id = ${subject}`
          )
        )
  const byId = new Map<string, HostAdmin>([
    ...bound.map((account) => [account.id, { ...account, byEmail: false }] as const),
    ...named.map((account) => [account.id, { ...account, byEmail: true }] as const),
  ])
  return [...byId.values()]
}

/** Set the password `userId` signs in with, on its credential account, hashed as sign-up hashes it. */
export const setCredentialPassword = async (
  database: DatabaseService,
  userId: string,
  password: string
): Promise<void> => {
  const hash = await hashPassword(password)
  await executeRawOn(
    database.dialect.kind,
    database.client,
    sql`UPDATE ${database.dialect.sql.authTableRef('account')} SET password = ${hash}
        WHERE user_id = ${userId} AND provider_id = 'credential'`
  )
}

/** Set an account's name and role. */
export const updateAccountProfile = async (
  database: DatabaseService,
  userId: string,
  profile: { readonly name: string; readonly role: string }
): Promise<void> => {
  await executeRawOn(
    database.dialect.kind,
    database.client,
    sql`UPDATE ${database.dialect.sql.authTableRef('user')} SET name = ${profile.name},
        role = ${profile.role} WHERE id = ${userId}`
  )
}

/** Give an account the admin role. */
export const setAdminRole = async (database: DatabaseService, userId: string): Promise<void> => {
  await executeRawOn(
    database.dialect.kind,
    database.client,
    sql`UPDATE ${database.dialect.sql.authTableRef('user')} SET role = 'admin' WHERE id = ${userId}`
  )
}

/** The role each of `userIds` holds now. */
export const readUserRoles = async (
  database: DatabaseService,
  userIds: readonly string[]
): Promise<ReadonlyMap<string, string | undefined>> => {
  if (userIds.length === 0) return new Map()
  const rows = await executeRawOn(
    database.dialect.kind,
    database.client,
    sql`SELECT id, role FROM ${database.dialect.sql.authTableRef('user')} WHERE id IN (${boundList(userIds)})`
  )
  return new Map(
    rows.map((row) => [String(row.id), typeof row.role === 'string' ? row.role : undefined])
  )
}

/**
 * Remove an account by the engine's own erasure (`purgeAccount`), the one
 * behind the scheduled purge and the account-deletion link, rather than by a
 * delete of its user row: a demo visitor's account is personal data, and the
 * user row's cascades leave some of it behind. The erasure's last-admin rail
 * also holds here: an account that is the last one able to administer the app
 * is kept. Answers whether it was erased.
 */
export const eraseAccount = async (
  database: DatabaseService,
  userId: string,
  app: Readonly<App>
): Promise<boolean> => {
  const appTables = (app.tables ?? []).map((table) =>
    resolvePurgeTableAuthorship(app.tables, table.name)
  )
  const outcome = await purgeAccount(userId, appTables, app, liveErasureSeams(database)).catch(
    (error: unknown) => {
      throw new Error(`reset could not remove the account ${userId}: ${describeFailure(error)}`)
    }
  )
  return outcome._tag === 'Erased'
}

/** How many rows an app table holds. */
export const countAppTableRows = async (
  database: DatabaseService,
  table: string
): Promise<number> =>
  Number(
    (
      await executeRawOn(
        database.dialect.kind,
        database.client,
        sql`SELECT COUNT(*) AS n FROM ${tableIdentifier(table)}`
      )
    )[0]?.n ?? 0
  )

/**
 * Empty an app table and answer how many rows it held. A link table carries a
 * foreign key to both ends, so the ones `junctions` names are cleared first; a
 * link table that does not exist is not an error.
 */
export const emptyAppTable = async (
  database: DatabaseService,
  table: string,
  junctions: readonly string[]
): Promise<number> => {
  const held = await countAppTableRows(database, table)
  await Promise.all(
    junctions.map((junction) =>
      executeRawOn(
        database.dialect.kind,
        database.client,
        sql`DELETE FROM ${tableIdentifier(junction)}`
      ).catch(() => undefined)
    )
  )
  await executeRawOn(
    database.dialect.kind,
    database.client,
    sql`DELETE FROM ${tableIdentifier(table)}`
  ).catch((error: unknown) => {
    throw new Error(`reset could not empty the table "${table}": ${describeFailure(error)}`)
  })
  return held
}
