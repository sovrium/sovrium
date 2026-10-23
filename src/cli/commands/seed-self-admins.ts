/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The host's administrators, which an `app/seed` reset keeps.
 *
 * They are host configuration, not app data: the account `AUTH_ADMIN_EMAIL`
 * names, and the account whose Sovrium Cloud link carries
 * `SOVRIUM_PLATFORM_SSO_ADMIN_SUBJECT` — one account or two. A reset that
 * removed them would leave the operator of a demo locked out of the console
 * the morning after, since the server creates its first admin only on an empty
 * database. Each keeps its id, its sign-in rows and the admin role; only its
 * sessions go, like everyone's.
 */

import { sql } from 'drizzle-orm'
import {
  PLATFORM_SSO_PROVIDER_ID,
  SOVRIUM_PLATFORM_SSO_ADMIN_SUBJECT_VAR,
} from '@/domain/models/process-env/platform-sso'
import { db } from '@/infrastructure/database'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import { authTableRef, authUserTableRef } from '@/infrastructure/database/sql/dialect-sql'
import type { SeedAccount } from '@/domain/models/seed'

/** One administrator the host names, and how. */
export interface HostAdmin {
  readonly id: string
  /** Lower-cased. */
  readonly email: string
  /** Named by `AUTH_ADMIN_EMAIL`, whose `AUTH_ADMIN_PASSWORD` it signs in with. */
  readonly byEmail: boolean
}

const setting = (name: string): string | undefined => {
  const value = Bun.env[name]?.trim()
  return value === undefined || value === '' ? undefined : value
}

const accountsOf = (rows: readonly Record<string, unknown>[]) =>
  rows.flatMap((row) =>
    typeof row.email === 'string' ? [{ id: String(row.id), email: row.email.toLowerCase() }] : []
  )

/** The host's administrators that exist in the database; none when neither variable is set. */
export const readHostAdmins = async (): Promise<readonly HostAdmin[]> => {
  const email = setting('AUTH_ADMIN_EMAIL')?.toLowerCase()
  const subject = setting(SOVRIUM_PLATFORM_SSO_ADMIN_SUBJECT_VAR)
  const named =
    email === undefined
      ? []
      : accountsOf(
          await executeRaw(
            db,
            sql`SELECT id, email FROM ${authUserTableRef()} WHERE lower(email) = ${email}`
          )
        )
  const bound =
    subject === undefined
      ? []
      : accountsOf(
          await executeRaw(
            db,
            sql`SELECT u.id, u.email FROM ${authUserTableRef()} u
                JOIN ${authTableRef('account')} a ON a.user_id = u.id
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
export const setCredentialPassword = async (userId: string, password: string): Promise<void> => {
  const { hashPassword } = await import('better-auth/crypto')
  const hash = await hashPassword(password)
  await executeRaw(
    db,
    sql`UPDATE ${authTableRef('account')} SET password = ${hash}
        WHERE user_id = ${userId} AND provider_id = 'credential'`
  )
}

/**
 * Put every host administrator back to the admin role, and — for the one
 * `AUTH_ADMIN_EMAIL` names, when `seed/users.yaml` does not list it — to
 * `AUTH_ADMIN_PASSWORD` when that is set. A listed administrator takes its
 * name and password from the file, which the listed accounts were restored
 * from already.
 */
export const restoreHostAdmins = async (
  admins: readonly HostAdmin[],
  listed: readonly SeedAccount[]
): Promise<void> => {
  const listedEmails = new Set(listed.map((account) => account.email.toLowerCase()))
  const password = setting('AUTH_ADMIN_PASSWORD')
  await admins.reduce<Promise<void>>(
    (previous, admin) =>
      previous.then(async () => {
        await executeRaw(
          db,
          sql`UPDATE ${authUserTableRef()} SET role = 'admin' WHERE id = ${admin.id}`
        )
        if (!admin.byEmail || password === undefined || listedEmails.has(admin.email)) return
        await setCredentialPassword(admin.id, password)
      }),
    Promise.resolve()
  )
}
