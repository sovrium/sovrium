/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql, type SQL } from 'drizzle-orm'
import { executeRaw } from './sql/dialect-execute'
import { authTableRef } from './sql/dialect-sql'
import type { DrizzleTransaction } from '@/infrastructure/database'

/**
 * The pending tokens of a person, in `auth.verification`, and the statements
 * that remove them when she is erased.
 *
 * The table is one token store shared by Better Auth and Sovrium, and a row
 * names its owner in one of three ways:
 *
 *   - its VALUE is her user id: a password-reset link (`reset-password:<token>`),
 *     an account-deletion link (`delete-account-<token>`), a trusted device
 *     (`trust-device-<random>`), a pending sign-in second step, and an
 *     invitation to her written without an inviter (`invitation:<token>`);
 *   - its value is the invitation envelope naming her as the invitee,
 *     `{"userId":"<her id>","invitedBy":"<id>"}` — see `invitation-queries.ts`.
 *     An invitation she SENT is the invitee's: it stays acceptable, and only
 *     her id leaves it ({@link shedInviterFromInvitations});
 *   - its IDENTIFIER is her address, as Better Auth stores it (lowercased):
 *     the address itself, or one of the email-code identifiers
 *     `<type>-otp-<address>`; or her user id, as the emailed second-step
 *     code `2fa-otp-<user id>!<session id>`.
 *
 * Every value and prefix is a bound parameter. The prefix comparisons use
 * `substr` rather than `LIKE`, so a `%` or `_` in an id or an address is a
 * character, never a wildcard.
 */

/** The email-code kinds Better Auth keys by `<type>-otp-<address>`. */
const EMAIL_CODE_TYPES = ['email-verification', 'sign-in', 'forget-password'] as const

/** `<column>` begins with `prefix`, the prefix bound (and measured by the database). */
const startsWith = (column: 'identifier' | 'value', prefix: string): SQL =>
  sql`substr(${sql.identifier(column)}, 1, length(${prefix})) = ${prefix}`

/**
 * The statements that delete every `auth.verification` row of the erased
 * person. Rows of anybody else are untouched: each predicate matches her id or
 * her address exactly, or a prefix that ends on a delimiter after it.
 *
 * @param userId - The erased person's id.
 * @param email - Her address, when it could be read; without it the
 *   address-keyed rows are skipped rather than matched against an empty string.
 */
export const verificationRowsOf = (userId: string, email: string | undefined): readonly SQL[] => {
  const table = authTableRef('verification')
  const byId = [
    sql`DELETE FROM ${table} WHERE value = ${userId}`,
    sql`DELETE FROM ${table}
        WHERE ${startsWith('identifier', 'invitation:')}
          AND ${startsWith('value', `{"userId":${JSON.stringify(userId)},`)}`,
    sql`DELETE FROM ${table} WHERE ${startsWith('identifier', `2fa-otp-${userId}!`)}`,
  ]
  if (email === undefined || email.length === 0) return byId
  const address = email.toLowerCase()
  const identifiers = [address, ...EMAIL_CODE_TYPES.map((type) => `${type}-otp-${address}`)]
  return [
    ...byId,
    sql`DELETE FROM ${table} WHERE identifier IN (${sql.join(
      identifiers.map((identifier) => sql`${identifier}`),
      sql`, `
    )})`,
  ]
}

/** The invitee an invitation envelope names, when `invitedBy` is `inviterId`. */
const inviteeOfInvitationSentBy = (value: string, inviterId: string): string | undefined => {
  try {
    const parsed = JSON.parse(value) as { readonly userId?: unknown; readonly invitedBy?: unknown }
    return parsed.invitedBy === inviterId && typeof parsed.userId === 'string'
      ? parsed.userId
      : undefined
  } catch {
    return undefined
  }
}

/**
 * Take the erased person's id out of the invitations she sent, and keep them.
 *
 * Such an invitation belongs to its invitee, who can still accept it, so the
 * row stays and only the inviter goes — the same verdict the erasure gives her
 * authorship stamps on somebody else's records. The value is rewritten to the
 * bare invitee id, which is how the invitation flow stores an invitation with no
 * recorded inviter (`encodeInvitationValue` in `invitation-queries.ts`), so
 * every reader keeps resolving it. The envelope is matched in memory: its key
 * order is a JSON detail a SQL pattern would have to hard-code.
 */
async function shedInviterFromInvitations(
  tx: Readonly<DrizzleTransaction>,
  userId: string
): Promise<void> {
  const table = authTableRef('verification')
  const rows = (await executeRaw(
    tx,
    sql`SELECT id, value FROM ${table}
        WHERE ${startsWith('identifier', 'invitation:')} AND ${startsWith('value', '{')}`
  )) as readonly { readonly id: string; readonly value: string }[]
  for (const row of rows) {
    const invitee = inviteeOfInvitationSentBy(row.value, userId)
    if (invitee === undefined) continue
    await executeRaw(tx, sql`UPDATE ${table} SET value = ${invitee} WHERE id = ${row.id}`)
  }
}

/**
 * Run {@link verificationRowsOf} inside the erasure's transaction, then shed her
 * from the invitations she sent ({@link shedInviterFromInvitations}).
 */
export async function deleteVerificationRows(
  tx: Readonly<DrizzleTransaction>,
  userId: string,
  email: string | undefined
): Promise<void> {
  for (const statement of verificationRowsOf(userId, email)) {
    await executeRaw(tx, statement)
  }
  await shedInviterFromInvitations(tx, userId)
}
