/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { executeRawOn } from '@/infrastructure/database/sql/dialect-execute'
import type { AccountIndex } from './accounts'
import type { DatabaseService } from '@/infrastructure/database/drizzle/layer'

/**
 * Every account in the database, by lower-cased email.
 *
 * The auth tables are created by the migrations every seed run applies first,
 * whether or not the app configures `auth:`, so an app without accounts reads
 * an empty table. A failing read is therefore a real failure and is not
 * swallowed: treated as "no accounts", it would turn an unreachable database
 * into a misleading "no account has that email" refusal.
 */
export const readAccountIndex = async ({
  client,
  dialect,
}: DatabaseService): Promise<AccountIndex> => {
  const rows = await executeRawOn(
    dialect.kind,
    client,
    sql`SELECT id, email FROM ${dialect.sql.authTableRef('user')}`
  )
  return new Map(
    rows.flatMap((row) =>
      typeof row.email === 'string' && (typeof row.id === 'string' || typeof row.id === 'number')
        ? [[row.email.toLowerCase(), String(row.id)] as const]
        : []
    )
  )
}

/**
 * The accounts that are themselves still pending invitations, by lower-cased
 * email: an outstanding invitation and no password. Such an account cannot
 * sign in until it accepts, so it cannot be the account an invitation is from.
 */
export const readPendingInvitees = async ({
  client,
  dialect,
}: DatabaseService): Promise<ReadonlySet<string>> => {
  // An invitation is a `verification` row named `invitation:<token>`, whose value
  // is the invitee's id — bare, or inside a `{ "userId": … }` envelope (the
  // shapes `invitation-queries.ts` writes).
  const invitations = await executeRawOn(
    dialect.kind,
    client,
    sql`SELECT value FROM ${dialect.sql.authTableRef('verification')} WHERE identifier LIKE 'invitation:%'`
  )
  const invitees = new Set(
    invitations.flatMap((row) => (typeof row.value === 'string' ? [inviteeIdOf(row.value)] : []))
  )
  if (invitees.size === 0) return new Set()
  const withoutPassword = await executeRawOn(
    dialect.kind,
    client,
    sql`SELECT u.id, u.email FROM ${dialect.sql.authTableRef('user')} u WHERE NOT EXISTS (
      SELECT 1 FROM ${dialect.sql.authTableRef('account')} a
      WHERE a.user_id = u.id AND a.provider_id = 'credential' AND a.password IS NOT NULL)`
  )
  return new Set(
    withoutPassword.flatMap((row) =>
      invitees.has(String(row.id)) && typeof row.email === 'string' ? [row.email.toLowerCase()] : []
    )
  )
}

/** The invitee id an invitation row's value carries, in either of its two shapes. */
const inviteeIdOf = (value: string): string => {
  if (!value.startsWith('{')) return value
  try {
    const parsed = JSON.parse(value) as { readonly userId?: unknown }
    return typeof parsed.userId === 'string' ? parsed.userId : value
  } catch {
    return value
  }
}
